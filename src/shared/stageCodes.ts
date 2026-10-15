// 스테이지 모드의 판 코드 형식. 카탈로그는 레벨 1~5, 각 10판이며 코드는 `레벨-번호`다.
// 무한모드 판 식별자(`e-…`)와 구분하여 입장 키의 용도를 서버에서 판정하는 데 쓴다.
const STAGE_CODE = /^[1-5]-([1-9]|10)$/;

export function isStageCode(code: string): boolean {
  return STAGE_CODE.test(code);
}
