# Example images

Drop your images into these folders using the exact file names below. Until a file
exists, the app shows a tile-pattern placeholder in its place, so you can add them a
few at a time. JPG, about 1200 px on the long side and under 400 KB each is ideal.

## Layout previews (one per layout card)

    templates/<layout id>.jpg

    floor-full.jpg      floor-corners.jpg   floor-center.jpg   floor-border.jpg
    floor-checker.jpg   walls-all.jpg       wall-back.jpg      wall-left.jpg
    wall-right.jpg      wall-feature.jpg    wall-half.jpg      mixed.jpg
    theme-transfer.jpg

## Examples users can pick instead of uploading (10 per folder: 01.jpg … 10.jpg)

    floor/tiles/01.jpg … 10.jpg            tiles that suit floors
    floor/rooms/01.jpg … 10.jpg            rooms with a clear, visible floor
    walls/tiles/01.jpg … 10.jpg            wall tiles
    walls/rooms/01.jpg … 10.jpg            rooms with clear, visible walls
    floor-and-walls/tiles/01.jpg … 10.jpg
    floor-and-walls/rooms/01.jpg … 10.jpg
    theme/sites/01.jpg … 10.jpg            unfinished / construction sites
    theme/references/01.jpg … 10.jpg       finished interiors to copy the look from

Tile photos: straight-on, evenly lit, cropped to the tile. Room photos: eye level,
landscape, no people. Names and folders are set in src/lib/samples.ts if you want
different counts or names.
