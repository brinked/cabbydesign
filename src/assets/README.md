# Custom appliance graphics

Drop dealer-provided appliance art here (e.g. `grill-head.svg`).

## Grill head
- **Front view**, transparent background.
- Only the **appliance** (hood + control panel + knobs + handle) — NOT the cabinet
  doors below it. The cabinet body stays parametric (finish/width/doors vary).
- **SVG preferred** (keep its `viewBox`); transparent PNG also accepted.
- Natural proportion ~30–48″ wide × ~18–22″ tall; it is scaled to the cabinet
  width at render time.

Once a file is here, it is wired into the grill cabinet's head in the elevation
and report views (see `src/components/CabinetImage.tsx`).
