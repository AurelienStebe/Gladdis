import fs from 'fs-extra'
import process from 'process'
import { tar, zip } from 'zip-a-folder'

const targetVersion = process.argv[2] ?? process.env.npm_package_version

if (targetVersion !== undefined) {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'))
    const { minAppVersion } = manifest
    manifest.version = targetVersion
    fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 4) + '\n')

    const versions = JSON.parse(fs.readFileSync('versions.json', 'utf-8'))
    versions[targetVersion] = minAppVersion
    fs.writeFileSync('versions.json', JSON.stringify(versions, null, 4) + '\n')
}

tar('vault', 'vault.tgz').then(() => zip('vault', 'vault.zip').then(() => process.exit(0)))
