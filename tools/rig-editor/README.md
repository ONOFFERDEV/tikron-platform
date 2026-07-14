# rig-editor — 리깅 GLB 브라우저 편집 툴 (내부 도구)

파이프라인(UniRig)이 뽑은 리깅 캐릭터 GLB를 브라우저에서 열어 **본 각도를 직접 보정**하고
**클립 키프레임 포즈를 편집**해, 게임 투입 가능한 GLB로 재내보내는 로컬 전용 도구.
Rocky 렌더 왕복 없이 사후 교정하는 것이 목적이다 (2026-07-13 cyber-trooper "팔 등 뒤 접힘"
수리 경험에서 출발 — 그 결함 부류를 사람 손으로 즉석 교정할 수 있어야 한다).

## 실행

```bash
pnpm --filter rig-editor dev      # esbuild serve, http://127.0.0.1:8642
pnpm --filter rig-editor typecheck
```

백엔드 없음. 전부 클라이언트 사이드. 배포하지 않는다.

## 스택 (레포 관례 준수)

- TypeScript + three `^0.185.1` (ironsight와 동일 메이저) + esbuild bundle/serve
- 플레인 DOM UI (프레임워크 없음 — ironsight client 관례)
- 워크스페이스 패키지 `tools/rig-editor` (`pnpm --filter rig-editor ...`)

## 기능 스펙

### M1 — 뷰어 + 전역 본 보정
1. **GLB 로드**: 드래그&드롭 + 파일 선택 버튼. KHR_mesh_quantization GLB 지원(three 네이티브).
   로드 시 애니메이션 클립 목록·본 계층 파싱.
2. **뷰포트**: OrbitControls, 그리드, SkeletonHelper 오버레이(토글),
   머티리얼 토글 = 원본 ↔ 게임 플랫 머티리얼(MeshStandardMaterial, FrontSide, 플랫 틴트 —
   게임 검증 조건 재현. 근거: 위키 skinned-mesh-explosion-forensics-ladder "검증 렌더는
   게임과 동일한 머티리얼로").
3. **본 선택**: 좌측 본 트리 패널 + 뷰포트에서 관절 스피어 클릭 picking. 선택 본 하이라이트,
   본명·부모·현재 로컬 회전(오일러 표시) 패널 표기.
4. **회전 기즈모**: TransformControls(rotate, 로컬 축)로 선택 본 조작.
5. **전역 보정 레이어**: 본별 상수 보정 회전(쿼터니언) — 재생 중 모든 클립에 실시간 반영.
   구현 주의: AnimationMixer가 매 프레임 본 회전을 덮어쓰므로 보정은 mixer.update() 이후에
   합성 적용(합성 순서 pre/post는 "어깨 로컬축 회전이 직관적으로 움직이는지" 시각 검증으로 확정).
6. **재생 컨트롤**: 클립 드롭다운, 재생/일시정지, 루프, 속도(0.25/0.5/1x), 타임라인 스크럽 바.
7. **내보내기 2종**:
   - 보정 JSON: `{ "본명": [x,y,z,w], ... }` — 파이프라인(retarget_clips.py)이 캐릭터별
     오버라이드로 소비할 수 있는 형태(소비 훅은 이 도구 범위 밖, 별도 작업).
   - 베이크 GLB: 모든 클립의 해당 본 쿼터니언 트랙에 보정을 합성한 뒤 GLTFExporter로 export.
     파일명 `<원본명>-edited.glb` 다운로드.
8. **리셋/언두**: 본별 리셋, 전체 리셋, 실행취소/재실행(간단 스택, 보정·키 편집 공용).

### M2 — 키프레임 편집
9. 타임라인에 **선택 본의 키프레임 틱** 표시(현재 클립 기준). 틱 클릭 = 그 시각으로 점프+일시정지.
10. 키 선택 상태에서 기즈모로 포즈 수정 → **그 키의 쿼터니언 트랙 값 갱신**(주변 키·보간 방식은
    유지). 수정된 키는 틱 색상으로 구분.
11. 키 편집은 클립별 로컬 레이어로, 전역 보정과 독립(내보내기 시 둘 다 반영: 키 값 갱신 후
    전역 보정 합성).
12. (여유 시) 선택 키 복제/삭제.

### M3 — 자동 생성 연결 (Generate 패널)
13. **UI**: LOAD 패널 위에 GENERATE 패널 — 프롬프트(영문, 파이프라인 Flux 템플릿에 조각으로
    들어감), 이름(프롬프트에서 슬러그 자동 생성, 수정 가능), 시드(빈칸=서버측 랜덤), 백엔드
    선택(hunyuan 기본 | trellis), game-slim 체크(기본 해제 — 캐릭터는 비-slim 관례),
    [Generate] 버튼, 진행 로그 패널(파이프라인 stdout 라인 실시간 표시).
14. **로컬 API**(scripts/dev.mjs 확장 — esbuild serve 앞단에 node http 핸들러):
    - `POST /api/generate` {prompt,name,seed?,backend,gameSlim} → 202 {jobId}. 동시 1작업 락(409).
    - `GET /api/generate/:jobId/events` → SSE: 파이프라인 stdout/stderr 라인 + 종료 이벤트(성공/실패).
    - `GET /api/generate/:jobId/result.glb` → 완료 시 GLB 서빙.
    - 구현: `child_process.spawn("ssh", ["onofferserver", <원커맨드>])`로
      `bash ~/assetgen/unirig_pipeline.sh "<prompt>" <name> [seed] [--game-slim] [--backend ...]`
      실행, 완료 후 `scp onofferserver:~/unirig/poc_out/<name>/rigged-animated.glb` →
      `tools/rig-editor/.cache/<name>.glb`(디렉토리 gitignore). 타임아웃 10분.
    - **셸 인젝션 방어**: prompt/name은 화이트리스트(`[A-Za-z0-9 ,.'-]` / `[a-z0-9-]`)로 검증,
      불통과 시 400. 로컬 전용(127.0.0.1 바인딩)이어도 방어는 정식으로.
15. **클라 연결**: 완료 이벤트 수신 → result.glb fetch → 기존 GLB 로드 경로로 자동 로드.
    실패 시 로그 패널에 원문 그대로(파이프라인 게이트 FAIL 메시지 포함).

### 나이스투해브 (시간 남을 때만)
- 레퍼런스 고스트: 두 번째 GLB(KayKit 레퍼런스 등)를 옆에 반투명 로드, 같은 클립명 동기 재생.
- 인브라우저 quantize: `@gltf-transform/core`+`functions`를 번들해 export 시 재양자화(용량 복원).

## 알려진 함정 (구현 전 숙지)

- **GLTFExporter 왕복은 양자화를 잃는다** — export 결과는 원본(3.9MB quantized)보다 커진다.
  MVP에선 export 후 "게임 투입 전 quantize 필요(`gltf-transform quantize`)" 안내를 UI에 표기.
- 쿼터니언 트랙 직접 수정 시 **반구 연속성**(인접 키와 dot<0) 주의 — 수정 키 저장 시 인접 키와
  dot<0이면 부호 반전으로 정규화(위키 forensics ladder 4번 항목의 부류).
- 본 트리는 직렬 체인 가정 금지(손목 분기 실례 있음) — 계층은 실제 그래프로 그린다.
- 스크럽 정확성: mixer.setTime 계열로 정확한 t 재생이 유지되어야 키 편집 UX가 성립한다.

## 수용 게이트 (본체가 수행)

1. `player.glb`(armfix본) 로드 → 어깨 본 +30° 보정 → 4클립 전부 실시간 반영 확인.
2. GLB 내보내기 → 내보낸 GLB를 Rocky killer 하네스로 렌더 → 보정 반영 + 메시 무결.
3. walk 클립 키프레임 1개 수정 → export → 재로드 시 수정 유지.
4. typecheck 클린 + 콘솔 에러 0.
