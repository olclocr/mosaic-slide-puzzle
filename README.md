# MOSAIC 슬라이드 퍼즐

기존 공개 배포 https://2a66ad54.mosaic-slide-puzzle.pages.dev/ 에서 가져온 로컬 작업 사본입니다.

## 로컬 실행

이 폴더에서 다음 명령을 실행하고 http://localhost:8000 을 엽니다.

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

WebAssembly를 불러오므로 `index.html`을 직접 더블 클릭하는 대신 HTTP 서버로 실행합니다.

## 수정할 파일

- `index.html`: 화면 구성과 기본 문구
- `style.css`: 디자인과 반응형 레이아웃
- `app.js`: 사용자 동작, 사진 처리, 게임 화면 제어
- `landscape.svg`: 기본 퍼즐 이미지
- `manifest.webmanifest`, `sw.js`, `icon*`: 설치 및 오프라인 지원
- `mosaic_core.wasm`: 배포된 Rust 퍼즐 엔진

Rust 원본 소스와 빌드 설정은 공개 배포에서 복구되지 않았습니다. 엔진을 다시 컴파일하려면 원본 프로젝트가 필요합니다.

## 배포

GitHub 저장소: https://github.com/olclocr/mosaic-slide-puzzle

GitHub Pages는 `main` 브랜치의 루트(`/`)를 정적 파일로 배포합니다. `.nojekyll`로 Jekyll 처리를 생략합니다.

Cloudflare Pages는 별도 배포 대상입니다. GitHub에 푸시해도 기존 Cloudflare 배포에는 자동 반영되지 않습니다.
