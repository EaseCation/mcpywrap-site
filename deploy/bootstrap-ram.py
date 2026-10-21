"""Create the main-branch OIDC role using an administrator's local aliyun profile."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ROLE = 'gh-oidc-mcpywrap-site-deploy'
POLICY = 'McpywrapSiteDeploy'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', required=True)
    parser.add_argument('--ssl-center', type=Path, help='Also extend the existing SSL Center policy')
    args = parser.parse_args()

    def call(api, **params):
        cmd = ['aliyun', 'ram', api, '--profile', args.profile]
        for key, value in params.items():
            cmd += ['--' + key, value]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                universal_newlines=True)
        if result.returncode:
            raise RuntimeError(result.stderr.split('RespHeaders:')[0].strip())
        return json.loads(result.stdout)

    trust = json.loads((ROOT / 'oidc-trust.json').read_text())
    policy = json.loads((ROOT / 'ram-policy.json').read_text())
    try:
        call('CreateRole', RoleName=ROLE, MaxSessionDuration='3600',
             AssumeRolePolicyDocument=json.dumps(trust))
    except RuntimeError as error:
        if 'EntityAlreadyExists' not in str(error):
            raise
        existing = call('GetRole', RoleName=ROLE)['Role']['AssumeRolePolicyDocument']
        if isinstance(existing, str):
            existing = json.loads(existing)
        if existing != trust:
            raise RuntimeError('Existing role trust differs; refusing to replace it')
    try:
        call('CreatePolicy', PolicyName=POLICY, PolicyDocument=json.dumps(policy))
    except RuntimeError as error:
        if 'EntityAlreadyExists' not in str(error):
            raise
        current = call('GetPolicy', PolicyType='Custom', PolicyName=POLICY)['Policy']
        version = call('GetPolicyVersion', PolicyType='Custom', PolicyName=POLICY,
                       VersionId=current['DefaultVersion'])['PolicyVersion']['PolicyDocument']
        if isinstance(version, str):
            version = json.loads(version)
        if version != policy:
            raise RuntimeError('Existing deployment policy differs; refusing to replace it')
    call('AttachPolicyToRole', PolicyType='Custom', PolicyName=POLICY, RoleName=ROLE)
    print('Deployment OIDC role and bucket/domain permissions configured.')

    if args.ssl_center:
        name = 'SslCenterCertRenewOidcPolicy'
        current = call('GetPolicy', PolicyType='Custom', PolicyName=name)['Policy']
        existing = call('GetPolicyVersion', PolicyType='Custom', PolicyName=name,
                        VersionId=current['DefaultVersion'])['PolicyVersion']['PolicyDocument']
        if isinstance(existing, str):
            existing = json.loads(existing)
        resource = 'acs:cdn:*:1083406401917880:domain/mcpy.easecation.net'
        target = next(s for s in existing['Statement']
                      if 'cdn:SetCdnDomainSSLCertificate' in s.get('Action', []))
        if resource not in target['Resource']:
            target['Resource'].append(resource)
            call('CreatePolicyVersion', PolicyName=name, SetAsDefault='true',
                 PolicyDocument=json.dumps(existing))
        path = args.ssl_center / 'infra/aliyun/ssl-center-renew-policy.json'
        path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + '\n')
        print('SSL Center policy includes only the additional mcpy CDN domain.')


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as error:
        raise SystemExit(str(error))
