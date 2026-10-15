// 네이버페이 주문형 2.1. 모든 동적 텍스트는 XML 1.0 문자 검증과 이스케이프를 거칩니다.
export function xml(value: string | number | boolean): string {
  return (
    String(value)
      // XML 1.0에서 금지된 제어문자 제거
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  );
}
export const tag = (name: string, value: string | number | boolean) =>
  `<${name}>${xml(value)}</${name}>`;
export const documentXml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>${body}`;
export const shippingXml = () =>
  `<shippingPolicy><groupId>dayoff</groupId><method>DELIVERY</method><feeType>CONDITIONAL_FREE</feeType><feePayType>PREPAYED</feePayType><feePrice>4000</feePrice><conditionalFree><basePrice>100000</basePrice></conditionalFree><surchargeByArea><apiSupport>true</apiSupport></surchargeByArea></shippingPolicy>`;
