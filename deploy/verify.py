"""Verify the published multi-page site, directory rewrites, assets and real 404s."""
import argparse
import gzip
import hashlib
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1] / 'dist'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch(url):
    request = Request(url, headers={'Accept-Encoding': 'identity', 'User-Agent': 'mcpywrap-site-deploy-verifier'})
    try:
        response = urlopen(request, timeout=25)
    except HTTPError as error:
        response = error
    with response:
        data = response.read()
        if response.headers.get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)
        return response.status, response.headers, data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='https://mcpy.easecation.net')
    parser.add_argument('--attempts', type=int, default=3)
    args = parser.parse_args()
    base = args.base_url.rstrip('/')
    routes = {'/': 'index.html', '/wiki/': 'wiki/index.html', '/wiki': 'wiki/index.html'}
    for path in ('start/install', 'start/first-project', 'start/vscode', 'local/gui',
                 'local/worlds', 'local/macos', 'project/dependencies', 'runtime/debug', 'runtime/input'):
        for suffix in ('', '/'):
            routes[f'/wiki/{path}{suffix}'] = f'wiki/{path}/index.html'
    routes['/sitemap-index.xml'] = 'sitemap-index.xml'
    html = (ROOT / 'index.html').read_text()
    assets = sorted(set(re.findall(r'(?:src|href)="(/_astro/[^"?]+)"', html)))
    for path in assets:
        routes[path] = path.lstrip('/')
    routes['/pagefind/pagefind.js'] = 'pagefind/pagefind.js'
    for path in sorted((ROOT / 'wiki-images').glob('*.webp')):
        routes['/wiki-images/' + path.name] = 'wiki-images/' + path.name
    missing = ('/__mcpywrap_missing__/', '/wiki/__mcpywrap_missing__', '/_astro/__mcpywrap_missing__.js')
    failures = []
    for path, local in list(routes.items()) + [(path, None) for path in missing]:
        expected = 404 if local is None else 200
        issue = ''
        for attempt in range(args.attempts):
            try:
                status, headers, data = fetch(base + path)
                if status != expected:
                    raise ValueError(f'HTTP {status}, expected {expected}')
                if local is not None:
                    source = (ROOT / local).read_bytes()
                    if hashlib.sha256(data).digest() != hashlib.sha256(source).digest():
                        raise ValueError('Response differs from this build')
                    content_type = headers.get('Content-Type', '')
                    expected_type = next((mime for suffix, mime in (
                        ('.html', 'text/html'), ('.js', 'javascript'),
                        ('.css', 'text/css'), ('.png', 'image/png'), ('.webp', 'image/webp'),
                    ) if local.endswith(suffix)), None)
                    if expected_type and expected_type not in content_type:
                        raise ValueError(f'Incorrect Content-Type: {content_type}')
                    if path.startswith('/_astro/') and 'immutable' not in headers.get('Cache-Control', ''):
                        raise ValueError('Hashed asset missing immutable cache policy')
                elif data != (ROOT / '404.html').read_bytes():
                    raise ValueError('Missing route did not serve the actual 404 page')
                print(f'PASS {expected} {path}')
                issue = ''
                break
            except (URLError, TimeoutError, ValueError) as error:
                issue = str(error)
                if attempt + 1 < args.attempts:
                    time.sleep(10)
        if issue:
            failures.append(f'{path}: {issue}')
    if failures:
        raise SystemExit('\n'.join(failures))
    if base.startswith('https://'):
        try:
            build_opener(NoRedirect).open(base.replace('https://', 'http://', 1) + '/', timeout=25)
        except HTTPError as response:
            if response.code not in (301, 302, 307, 308) or not response.headers.get('Location', '').startswith(base):
                raise SystemExit('HTTP entry did not redirect to the production HTTPS origin')
            print('PASS HTTP redirects to HTTPS')
        else:
            raise SystemExit('HTTP entry did not redirect to HTTPS')


if __name__ == '__main__':
    main()
