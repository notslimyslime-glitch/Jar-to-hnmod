import assert from "node:assert/strict";
import JSZip from "jszip";
import { packageAssetHmod } from "../lib/hmod-content-packager.ts";

const files = [
  { path: "assets/demo/textures/icon.png", bytes: new Uint8Array([137, 80, 78, 71]) },
  { path: "assets/demo/lang/en_us.json", bytes: new TextEncoder().encode('{"item.demo.test":"Test"}') }
];

const result = await packageAssetHmod({
  id: "demo",
  name: "Demo Resource Mod",
  version: "1.2.3",
  description: "A test package",
  files
});
assert.equal(result.fileName, "demo-assets-1.2.3.hmod");
assert.equal(result.assetCount, 2);
const zip = await JSZip.loadAsync(result.bytes, { checkCRC32: true });
assert.ok(zip.file("horizon-mod.toml"));
assert.match(await zip.file("horizon-mod.toml").async("string"), /api = "0.2"/);
assert.match(await zip.file("horizon-mod.toml").async("string"), /capabilities = \\[\\"registries\\"\\]/);
for (const file of files) {
  const actual = await zip.file(file.path).async("uint8array");
  assert.deepEqual([...actual], [...file.bytes]);
}

await assert.rejects(
  packageAssetHmod({ id: "demo", name: "Demo", version: "1", files: [{ path: "assets/other/icon.png", bytes: new Uint8Array([1]) }] }),
  /does not match mod id/
);
await assert.rejects(
  packageAssetHmod({ id: "demo", name: "Demo", version: "1", files: [{ path: "assets/demo/../secret", bytes: new Uint8Array([1]) }] }),
  /Unsupported Horizon resource path/
);
await assert.rejects(
  packageAssetHmod({ id: "demo", name: "Demo", version: "1", files: [{ path: "assets/demo/empty", bytes: new Uint8Array() }] }),
  /Empty asset/
);
await assert.rejects(
  packageAssetHmod({ id: "Bad ID", name: "Demo", version: "1", files }),
  /mod id/
);

console.log("Horizon .hmod asset packager tests passed.");
