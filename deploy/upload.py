"""Publish dist/ to the private production bucket, assets before HTML."""
import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
import os
from pathlib import Path

import oss2

BUCKET = 'easecation-mcpywrap-site'
ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com'
ROOT = Path(__file__).resolve().parents[1] / 'dist'


def headers_for(key, digest):
    content_type = mimetypes.guess_type(key)[0] or 'application/octet-stream'
    if key.endswith(('.js', '.mjs')):
        content_type = 'application/javascript; charset=utf-8'
    elif key.endswith('.html'):
        content_type = 'text/html; charset=utf-8'
    elif key.endswith('.css'):
        content_type = 'text/css; charset=utf-8'
    immutable = key.startswith('_astro/')
    cache = 'public,max-age=31536000,immutable' if immutable else 'public,max-age=300,must-revalidate'
    return {'Content-Type': content_type, 'Cache-Control': cache, 'x-oss-meta-sha256': digest}


def credentials(profile):
    if profile:
        # Local-only compatibility with the user's existing CLI profile. Never log credentials.
        config = json.loads((Path.home() / '.aliyun/config.json').read_text())
        selected = next(p for p in config['profiles'] if p['name'] == profile)
        if selected.get('mode') != 'AK':
            raise SystemExit('Use temporary credential environment variables for non-AK local profiles')
        return oss2.Auth(selected['access_key_id'], selected['access_key_secret'])
    return oss2.StsAuth(os.environ['ALIBABA_CLOUD_ACCESS_KEY_ID'],
                        os.environ['ALIBABA_CLOUD_ACCESS_KEY_SECRET'],
                        os.environ['ALIBABA_CLOUD_SECURITY_TOKEN'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', help='Local Alibaba Cloud CLI AK profile; CI uses OIDC STS environment variables')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if not all((ROOT / key).is_file() for key in ('index.html', '404.html', 'wiki/index.html', 'pagefind/pagefind.js')):
        raise SystemExit('Missing production entry points; run pnpm build first')
    files = {}
    for path in ROOT.rglob('*'):
        if path.is_symlink():
            raise SystemExit('Symlinks are not publishable')
        if not path.is_file():
            continue
        key = path.relative_to(ROOT).as_posix()
        if any(part.startswith('.') for part in path.relative_to(ROOT).parts) or path.suffix in ('.pem', '.key', '.env', '.map'):
            raise SystemExit(f'Unexpected private/development artifact: {key}')
        files[key] = path
    if args.dry_run:
        print(f'Validated {len(files)} production files for {BUCKET}; no cloud changes.')
        return
    bucket = oss2.Bucket(credentials(args.profile), ENDPOINT, BUCKET, connect_timeout=30)
    previous = {obj.key for obj in oss2.ObjectIterator(bucket)}

    def upload(key):
        path = files[key]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        headers = headers_for(key, digest)
        if key in previous:
            old = bucket.head_object(key).headers
            if all(old.get(name.lower()) == value for name, value in headers.items()):
                return
        bucket.put_object_from_file(key, str(path), headers=headers)

    for html in (False, True):
        batch = [key for key in files if key.endswith('.html') == html]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(upload, batch))
    # Old hashed bundles and search fragments can still be referenced by open pages.
    stale = sorted(key for key in previous - files.keys()
                   if not key.startswith(('_astro/', 'pagefind/')))
    for start in range(0, len(stale), 1000):
        bucket.batch_delete_objects(stale[start:start + 1000])
    print(f'Published {len(files)} files; removed {len(stale)} stale objects from {BUCKET}.')


if __name__ == '__main__':
    main()
