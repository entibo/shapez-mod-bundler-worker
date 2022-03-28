declare const API_KEY: string

import { unzip } from 'unzipit'

export async function handleRequest(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  if (pathname.startsWith('/bundle')) {
    const bundle = await getBundle(pathname.slice('/bundle/'.length))
    return new Response(bundle, { headers })
  } else if (pathname.startsWith('/mod')) {
    const mod = await getBundle(pathname.slice('/mod/'.length))
    return new Response(mod, { headers })
  }
  return new Response('', { status: 404, headers })
}

async function getMod(modName: string) {
  const url = `https://api.mod.io/v1/games/2978/mods?api_key=${API_KEY}&name_id=${modName}`
  const modInfo: any = await fetch(url).then((res) => res.json())

  const modObject = modInfo.data[0]
  if (!modObject) {
    throw `${modName}: not found`
  }

  const zipUrl = modObject.modfile?.download?.binary_url
  if (!zipUrl) {
    throw `${modName}: no download link available`
  }

  const zipInfo = await unzip(zipUrl)
  for (const [name, entry] of Object.entries(zipInfo.entries)) {
    if (!name.endsWith('.js')) continue
    return await entry.text()
  }

  throw `${modName}: no .js file found in zip`
}

async function getBundle(str: string) {
  let mods = []
  let errors = []
  for (const modName of str.split(',')) {
    try {
      const mod = await getMod(modName)
      mods.push(mod)
    } catch (e) {
      errors.push(e)
    }
  }
  let bundle = mods.map(wrapModForBundle).join('\n\n')
  if (errors.length) {
    const alertMsg = `Errors while downloading mods:\n` + errors.join('\n')
    bundle += `\n\nalert(\`${alertMsg}\`)`
  }
  return bundle
}

const footer = `
if (typeof Mod !== 'undefined') {
    if (typeof METADATA !== 'object') {
        throw new Error("No METADATA variable found");
    }
    window.$shapez_registerMod(Mod, METADATA);
}
`
function wrapModForBundle(mod: string) {
  return `
(() => {
/////  MOD START  /////
${mod}
/////  MOD END    /////
${footer}
})();`
}
