"""Apply only CONTACT/Resend settings to an existing production env file."""
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from email.utils import parseaddr


def configure(target):
    enabled = os.environ.get('CONTACT_DEPLOY_ENABLED', '')
    values = {
        'RESEND_API_KEY': os.environ.get('CONTACT_DEPLOY_API_KEY', ''),
        'RESEND_FROM_EMAIL': os.environ.get('CONTACT_DEPLOY_FROM_EMAIL', ''),
        'CONTACT_TO_EMAIL': os.environ.get('CONTACT_DEPLOY_TO_EMAIL', ''),
    }
    if not enabled and not any(values.values()):
        print('CONTACT deployment settings absent; existing settings preserved.')
        return
    if enabled not in ('true', 'false'):
        raise ValueError('CONTACT_ENABLED must be true or false.')
    if enabled == 'true':
        if not all(values.values()):
            raise ValueError('Enabled CONTACT requires API key, sender and recipient.')
        if not re.fullmatch(r're_[A-Za-z0-9_-]+', values['RESEND_API_KEY']):
            raise ValueError('Invalid Resend key format.')
        for name in ('RESEND_FROM_EMAIL', 'CONTACT_TO_EMAIL'):
            address = parseaddr(values[name])[1]
            if not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+', address):
                raise ValueError('Invalid email configuration.')
        if parseaddr(values['RESEND_FROM_EMAIL'])[1].lower().endswith('@resend.dev'):
            raise ValueError('Use a verified production sender domain.')
        if any(any(char in value for char in '\r\n\x00$') for value in values.values()):
            raise ValueError('Unsupported characters in CONTACT deployment settings.')
        updates = {**values, 'CONTACT_ENABLED': enabled}
    else:
        updates = {'CONTACT_ENABLED': 'false'}
    original = target.read_text()
    kept = []
    for line in original.splitlines(keepends=True):
        match = re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', line)
        if not match or match.group(1) not in updates:
            kept.append(line)
    body = ''.join(kept)
    if body and not body.endswith('\n'):
        body += '\n'
    body += ''.join(f'{name}={json.dumps(value, ensure_ascii=False)}\n' for name, value in updates.items())
    if body == original:
        print('CONTACT deployment settings already match.')
        return
    backup_dir = target.parent / 'backups'
    backup_dir.mkdir(mode=0o700, exist_ok=True)
    os.chmod(backup_dir, 0o700)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = backup_dir / f'contact-config-before-{stamp}.env'
    with os.fdopen(os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
        stream.write(original)
    fd, temporary = tempfile.mkstemp(prefix='.contact-env-', dir=target.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(body)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('CONTACT deployment settings applied; backup saved, values hidden.')


if __name__ == '__main__':
    try:
        configure(Path(sys.argv[1] if len(sys.argv) > 1 else '.env.deploy'))
    except (ValueError, OSError) as error:
        print(f'CONTACT deployment configuration failed: {error}', file=sys.stderr)
        sys.exit(1)
