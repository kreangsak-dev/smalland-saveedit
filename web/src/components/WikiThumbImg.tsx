import { useEffect, useRef, useState } from 'react';
import { getLocalWikiThumbUrl, MISSING_THUMB_URL, stripPetLabelForWikiThumb } from '@/lib/wikiImages';

type Props = {
  displayName: string;
  className?: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
  /** Fired only if both the local file and the shared placeholder fail to load. */
  onBothFailed?: () => void;
};

/**
 * Loads `public/wiki-thumbs/<name>.png` only; missing files use `public/no-thumb.svg`.
 */
export default function WikiThumbImg({
  displayName,
  className,
  alt,
  loading,
  onBothFailed,
}: Props) {
  const [src, setSrc] = useState(() => getLocalWikiThumbUrl(displayName));
  const tierRef = useRef<'local' | 'placeholder'>('local');

  useEffect(() => {
    tierRef.current = 'local';
    setSrc(getLocalWikiThumbUrl(displayName));
  }, [displayName]);

  const onError = () => {
    if (tierRef.current === 'local') {
      tierRef.current = 'placeholder';
      setSrc(MISSING_THUMB_URL);
      return;
    }
    onBothFailed?.();
  };

  return (
    <img
      src={src}
      alt={alt ?? displayName}
      className={className}
      loading={loading}
      onError={onError}
    />
  );
}

type PetProps = Omit<Props, 'displayName'> & { petLabel: string };

/** Same as WikiThumbImg but strips leading emoji from pet row labels. */
export function WikiPetThumbImg({ petLabel, ...rest }: PetProps) {
  const displayName = stripPetLabelForWikiThumb(petLabel) || petLabel;
  return <WikiThumbImg displayName={displayName} {...rest} />;
}
