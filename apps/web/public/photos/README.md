# Photography — shot list

Drop image files into this folder, then set the matching entry in
`apps/web/src/lib/project.ts` → `PHOTOS`.

Until a slot has a path, the page renders a designed navy panel in the correct
aspect ratio. Nothing looks broken while photos are still being sourced — so
add them one at a time, in whatever order they arrive.

```ts
// apps/web/src/lib/project.ts
export const PHOTOS = {
  hero: "/photos/hero.jpg",   // ← just set the path
  ...
}
```

| Key          | Aspect | Shot                                                    |
| ------------ | ------ | ------------------------------------------------------- |
| `hero`       | 21:9   | Aerial of the township, or the approach road at sunrise |
| `temple`     | 4:3    | Khatu Shyam Ji temple exterior                          |
| `siteEntry`  | 3:2    | Society gate / entrance arch                            |
| `roads`      | 4:3    | Internal developed road, ideally with street lighting   |
| `park`       | 4:3    | Landscaped park / green space                           |
| `plotLayout` | 16:9   | Layout plan, or demarcated plots on site                |

## Guidance

- **Shoot wide, shoot early.** Dawn and late afternoon light suit the palette
  far better than midday. The hero especially wants warm, low sun.
- **Minimum 2000px on the long edge** for `hero` and `plotLayout`; 1400px is
  enough for the rest.
- **Compress before committing.** Aim under ~300KB each — these load on
  mid-range Android phones over mobile data, which is most of the audience.
  `squoosh.app` or `tinypng.com` are fine for this.
- **Own the rights.** Use photographs of the actual site wherever possible.
  Real photos of the real land will outperform any stock image here, because
  the whole promise of the page is that this place already exists.

If you do use stock temporarily, Unsplash and Pexels both allow commercial use
without attribution — but replace them with site photography before the site is
promoted. A buyer who recognises a stock photo stops trusting the price.
