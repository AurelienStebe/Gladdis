import url from 'url'
import path from 'path'
import fs from 'fs-extra'

export function setLocalEnv(dataPath: string): any {
    process.env.GLADDIS_DATA_PATH = getTestPath(dataPath)
}

export async function cleanupTest(...fileNames: string[]): Promise<any> {
    await Promise.all(
        fileNames.map(async (fileName) => {
            await fs.remove(getTestPath(fileName))
        }),
    )
}

export function getTestPath(filePath: string): string {
    return path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), filePath)
}
