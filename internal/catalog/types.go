package catalog

// ItemDef is a row in the static item list used by the web UI.
type ItemDef struct {
	Class    string `json:"class"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Kind     string `json:"kind"` // stack, equipment, epic
}

type PetClass struct {
	Class string `json:"class"`
	Name  string `json:"name"`
}

type PetTrait struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	Category string `json:"category"`
}
