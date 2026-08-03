# Kitchen Tools conversion policy

Kitchen Tools performs deterministic, offline conversions. The shared constants live in `lib/kitchen-tools.ts` and use US customary kitchen volume units, not Imperial units.

## Constants

- 1 US cup = 236.5882365 ml
- 1 US tbsp = 14.7867648 ml
- 1 US tsp = 4.92892159 ml
- 1 US fl oz = 29.5735295625 ml
- 1 lb = 453.59237 g
- 1 oz = 28.349523125 g
- 1 in = 2.54 cm
- 1 stick butter = 4 oz = 8 US tbsp ≈ 113.398 g

These are fixed unit definitions or deterministic results derived from them.

## Ingredient-specific cup-to-gram conversions

The data model includes the requested initial ingredient names, but every `gramsPerUsCup` value remains `null`. No ingredient-specific cup-to-gram conversion is currently enabled because a reliable per-ingredient source has not yet been selected and documented.

Future values must include a source note, remain visibly approximate, preserve the original unit, and have dedicated tests. A universal cup-to-gram conversion is prohibited.
