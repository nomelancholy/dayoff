import importlib.util
from pathlib import Path
import unittest
from datetime import datetime, timezone, timedelta

spec=importlib.util.spec_from_file_location('configuration',Path(__file__).with_name('configure-npay-production.py'))
config=importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)

class ProductionConfigurationTest(unittest.TestCase):
    original='NAVER_ORDER_MODE=production\nNAVER_ORDER_API_MODE=sandbox\nUNRELATED=value\n'
    payload={'NAVER_ORDER_API_CLIENT_ID':'fake','NAVER_ORDER_API_CLIENT_SECRET':'$2b$04$abcdefghijklmnopqrstuu'}
    def stage(self):
        return config.configure(self.original,'install',self.payload)
    def test_stage_is_read_only_and_preserves_literal_secret(self):
        staged=self.stage()
        self.assertIn("NAVER_ORDER_SYNC_ENABLED='false'",staged)
        self.assertIn("NAVER_ORDER_INVENTORY_ENABLED='false'",staged)
        self.assertIn("NAVER_ORDER_API_CLIENT_SECRET='"+self.payload['NAVER_ORDER_API_CLIENT_SECRET']+"'",staged)
        self.assertIn('UNRELATED=value',staged)
    def test_stop_preserves_cutover_policy_and_production_credentials(self):
        start=datetime.now(timezone.utc).isoformat()
        active=config.configure(self.stage(),'activate',starts_at=start)
        stopped=config.configure(active,'stop')
        self.assertIn("NAVER_ORDER_SYNC_ENABLED='false'",stopped)
        self.assertIn("NAVER_ORDER_INVENTORY_ENABLED='true'",stopped)
        self.assertIn(start,stopped)
        self.assertIn(self.payload['NAVER_ORDER_API_CLIENT_SECRET'],stopped)
        with self.assertRaises(ValueError): config.configure(active,'install',self.payload)
    def test_expired_or_future_cutover_cannot_activate(self):
        for seconds in [-700, 700]:
            with self.assertRaises(ValueError):
                config.configure(self.stage(),'activate',starts_at=(datetime.now(timezone.utc)+timedelta(seconds=seconds)).isoformat())
    def test_ambiguous_configuration_and_extra_payload_are_rejected(self):
        with self.assertRaises(ValueError): config.configure(self.original+'NAVER_ORDER_API_MODE=sandbox\n','install',self.payload)
        with self.assertRaises(ValueError): config.configure(self.original,'install',{**self.payload,'unexpected':'value'})
    def test_bad_secret_and_nonproduction_checkout_are_rejected(self):
        with self.assertRaises(ValueError): config.configure(self.original,'install',{**self.payload,'NAVER_ORDER_API_CLIENT_SECRET':'invalid'})
        with self.assertRaises(ValueError): config.configure(self.original.replace('NAVER_ORDER_MODE=production','NAVER_ORDER_MODE=test'),'install',self.payload)

if __name__=='__main__': unittest.main()
