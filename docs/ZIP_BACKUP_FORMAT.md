# ZIP 备份格式

格式版本为 1，文件名为 `PourRecipe-Backup-YYYYMMDD-HHmmss.zip`。

```text
manifest.json
checksums.json
data/recipes.json
data/ingredients.json
data/steps.json
data/categories.json
data/tags.json
data/recipe-categories.json
data/recipe-tags.json
data/cook-records.json
data/images.json
data/ocr-records.json
images/full/{imageId}.bin
images/thumbnails/{imageId}.bin
```

manifest 包含格式、版本、应用版本、时间、Dexie 版本、对象数量、回收站标记和 SHA-256 算法。checksums 覆盖 manifest、全部 data JSON 和图片；每行记录相对路径、字节数和 SHA-256。checksums 文件本身不自校验。

导入上限：ZIP 512 MB、解压 1 GB、20,000 项，并拒绝异常压缩比、绝对路径和 `..`。
