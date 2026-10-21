"""Strict credential installation and cutover; never output secrets."""
from pathlib import Path
import base64, json, os, re, sys
from datetime import datetime, timezone

def configure(text, phase, payload=None, starts_at=None):
    def current(key):
        values=re.findall(r'^'+key+r'=(.*)$',text,re.M)
        if len(values)>1: raise ValueError('Duplicate environment key')
        return values[0].strip().strip("\"'") if values else ''
    if current('NAVER_ORDER_MODE')!='production': raise ValueError('Checkout must remain production')
    if phase=='install':
        if current('NAVER_ORDER_API_MODE') not in ('', 'sandbox') or current('NAVER_ORDER_INVENTORY_ENABLED')=='true':
            raise ValueError('Refusing to replace active production configuration')
        if not isinstance(payload,dict) or set(payload)!={'NAVER_ORDER_API_CLIENT_ID','NAVER_ORDER_API_CLIENT_SECRET'}:
            raise ValueError('Unexpected payload fields')
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',payload['NAVER_ORDER_API_CLIENT_ID']): raise ValueError('Invalid application ID')
        if not re.fullmatch(r'\$2[ab]\$\d{2}\$[./A-Za-z0-9]{22}',payload['NAVER_ORDER_API_CLIENT_SECRET']): raise ValueError('Invalid secret')
        updates={**payload,'NAVER_ORDER_API_MODE':'production','NAVER_ORDER_SYNC_ENABLED':'false','NAVER_ORDER_INVENTORY_ENABLED':'false'}
    elif phase=='activate':
        if current('NAVER_ORDER_API_MODE')!='production' or current('NAVER_ORDER_SYNC_ENABLED')!='false' or current('NAVER_ORDER_INVENTORY_ENABLED')!='false':
            raise ValueError('Preflight configuration required')
        start=datetime.fromisoformat(starts_at.replace('Z','+00:00'))
        if start.tzinfo is None or not 0 <= (datetime.now(timezone.utc)-start).total_seconds() < 600: raise ValueError('Stale cutover')
        updates={'NAVER_ORDER_SYNC_START_AT':starts_at,'NAVER_ORDER_SYNC_ENABLED':'true','NAVER_ORDER_INVENTORY_ENABLED':'true'}
    elif phase=='stop':
        # Preserve production credentials, policy, cutover and ledger after activation.
        updates={'NAVER_ORDER_SYNC_ENABLED':'false'}
    else: raise ValueError('Invalid phase')
    for key,value in updates.items():
        pattern=r'^'+key+r'=.*$'
        line=key+"='"+value+"'"
        text=re.sub(pattern,lambda _:line,text,flags=re.M) if re.search(pattern,text,re.M) else text.rstrip()+'\n'+line+'\n'
    return text

if __name__=='__main__':
    path=Path('.env.deploy'); phase=sys.argv[1]
    payload=json.loads(base64.b64decode(os.environ['NPAY_ORDER_API_PRODUCTION_SETUP_B64'],validate=True)) if phase=='install' else None
    receipt=json.loads(Path(sys.argv[2]).read_text()) if phase=='activate' else {}
    if phase=='activate' and not (receipt.get('authenticated') is True and receipt.get('recentOrderHistoryEmpty') is True and receipt.get('historyDaysChecked')==30):
        raise ValueError('Invalid preflight receipt')
    text=configure(path.read_text(),phase,payload,receipt.get('startsAt'))
    tmp=path.with_name('.env.deploy.npay-production.tmp')
    tmp.write_text(text);os.chmod(tmp,0o600);os.replace(tmp,path)
    print('Production API configuration phase completed: '+phase)
