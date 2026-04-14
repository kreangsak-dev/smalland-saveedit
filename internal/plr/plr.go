package plr

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"unicode/utf16"
)

// Magic is the 4-byte chunk signature for Smalland .plr files.
var Magic = []byte{0xc1, 0x83, 0x2a, 0x9e}

const ChunkHeaderSize = 48

// MaxUploadBytes caps POST /api/unpack body size (align with web client).
const MaxUploadBytes = 1 << 20 // 1 MiB

type SaveMeta struct {
	OuterMagic   string `json:"outer_magic"`
	NameLen      int    `json:"name_len"`
	Name         string `json:"name"`
	ChunkMaxSize int    `json:"chunk_max_size"`
}

type WrappedSave struct {
	Meta SaveMeta        `json:"_meta"`
	Data json.RawMessage `json:"data"`
}

func Unpack(data []byte) (*WrappedSave, error) {
	if len(data) < ChunkHeaderSize || !bytes.Equal(data[:4], Magic) {
		return nil, fmt.Errorf("not a valid Smalland .plr file")
	}

	var decompParts [][]byte
	var chunkMaxSize uint64
	offset := 0

	for offset < len(data) {
		if offset+ChunkHeaderSize > len(data) || !bytes.Equal(data[offset:offset+4], Magic) {
			return nil, fmt.Errorf("no magic at offset %d", offset)
		}
		chunkMax := binary.LittleEndian.Uint64(data[offset+8 : offset+16])
		compSize := binary.LittleEndian.Uint64(data[offset+16 : offset+24])
		uncompSize := binary.LittleEndian.Uint64(data[offset+24 : offset+32])
		if chunkMaxSize == 0 {
			chunkMaxSize = chunkMax
		}

		chunkStart := offset + ChunkHeaderSize
		chunkEnd := chunkStart + int(compSize)
		if chunkEnd > len(data) {
			return nil, fmt.Errorf("chunk data overflow at offset %d", offset)
		}

		r, err := zlib.NewReader(bytes.NewReader(data[chunkStart:chunkEnd]))
		if err != nil {
			return nil, fmt.Errorf("zlib init error: %w", err)
		}
		decompChunk, err := io.ReadAll(r)
		r.Close()
		if err != nil {
			return nil, fmt.Errorf("zlib decompress error: %w", err)
		}
		if uint64(len(decompChunk)) != uncompSize {
			return nil, fmt.Errorf("size mismatch: got %d expected %d", len(decompChunk), uncompSize)
		}
		decompParts = append(decompParts, decompChunk)
		offset = chunkEnd
	}

	decomp := bytes.Join(decompParts, nil)

	if len(decomp) < 12 {
		return nil, fmt.Errorf("payload too short")
	}
	nameLen := binary.LittleEndian.Uint32(decomp[4:8])
	nameBytes := decomp[8 : 8+nameLen]
	fstringOffset := 8 + int(nameLen)
	fstringLen := int(int32(binary.LittleEndian.Uint32(decomp[fstringOffset : fstringOffset+4])))
	jsonStart := fstringOffset + 4
	jsonChars := abs(fstringLen) - 1
	jsonByteLen := jsonChars * 2

	if jsonStart+jsonByteLen > len(decomp) {
		return nil, fmt.Errorf("json data overflow")
	}

	raw16 := decomp[jsonStart : jsonStart+jsonByteLen]
	u16s := make([]uint16, len(raw16)/2)
	for i := range u16s {
		u16s[i] = binary.LittleEndian.Uint16(raw16[i*2 : i*2+2])
	}
	jsonText := string(utf16.Decode(u16s))

	if !json.Valid([]byte(jsonText)) {
		return nil, fmt.Errorf("invalid json in save payload")
	}

	meta := SaveMeta{
		OuterMagic:   fmt.Sprintf("%x", Magic),
		NameLen:      int(nameLen),
		Name:         fmt.Sprintf("%x", nameBytes),
		ChunkMaxSize: int(chunkMaxSize),
	}

	return &WrappedSave{Meta: meta, Data: json.RawMessage(jsonText)}, nil
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func Repack(wrapped *WrappedSave) ([]byte, error) {
	var compacted bytes.Buffer
	if err := json.Compact(&compacted, wrapped.Data); err != nil {
		return nil, fmt.Errorf("json compact error: %w", err)
	}
	jsonStr := compacted.String()

	runes := []rune(jsonStr)
	u16s := utf16.Encode(runes)
	jsonBytes := make([]byte, len(u16s)*2+2)
	for i, v := range u16s {
		binary.LittleEndian.PutUint16(jsonBytes[i*2:], v)
	}

	nameBytes, err := hexDecode(wrapped.Meta.Name)
	if err != nil {
		return nil, fmt.Errorf("invalid name hex: %w", err)
	}
	nameLen := len(nameBytes)
	fstringLen := -(len(u16s) + 1)

	payload := make([]byte, 0, 4+4+nameLen+4+len(jsonBytes))
	payload = append(payload, 0, 0, 0, 0)
	b4 := make([]byte, 4)
	binary.LittleEndian.PutUint32(b4, uint32(nameLen))
	payload = append(payload, b4...)
	payload = append(payload, nameBytes...)
	binary.LittleEndian.PutUint32(b4, uint32(int32(fstringLen)))
	payload = append(payload, b4...)
	payload = append(payload, jsonBytes...)

	binary.LittleEndian.PutUint32(payload[0:4], uint32(len(payload)-4))

	log.Printf("[repack] jsonLen=%d u16s=%d nameLen=%d fstringLen=%d payloadLen=%d",
		len(jsonStr), len(u16s), nameLen, fstringLen, len(payload))

	chunkMax := wrapped.Meta.ChunkMaxSize
	if chunkMax == 0 {
		chunkMax = 131072
	}
	magic, err := hexDecode(wrapped.Meta.OuterMagic)
	if err != nil {
		magic = Magic
	}

	var output bytes.Buffer
	off := 0
	for off < len(payload) {
		end := off + chunkMax
		if end > len(payload) {
			end = len(payload)
		}
		chunk := payload[off:end]

		var compressed bytes.Buffer
		w, err := zlib.NewWriterLevel(&compressed, zlib.BestCompression)
		if err != nil {
			return nil, err
		}
		w.Write(chunk)
		w.Close()

		compData := compressed.Bytes()

		header := make([]byte, ChunkHeaderSize)
		copy(header[0:4], magic)
		binary.LittleEndian.PutUint64(header[8:16], uint64(chunkMax))
		binary.LittleEndian.PutUint64(header[16:24], uint64(len(compData)))
		binary.LittleEndian.PutUint64(header[24:32], uint64(len(chunk)))
		binary.LittleEndian.PutUint64(header[32:40], uint64(len(compData)))
		binary.LittleEndian.PutUint64(header[40:48], uint64(len(chunk)))

		output.Write(header)
		output.Write(compData)
		off = end
	}

	packed := output.Bytes()

	if _, err := Unpack(packed); err != nil {
		return nil, fmt.Errorf("repack verification failed (save aborted): %w", err)
	}

	return packed, nil
}

func hexDecode(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	b := make([]byte, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		_, err := fmt.Sscanf(s[i:i+2], "%02x", &b[i/2])
		if err != nil {
			return nil, err
		}
	}
	return b, nil
}
