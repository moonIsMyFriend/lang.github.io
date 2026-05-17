# Git push permission error
_Exported on 5/17/2026 at 13:38:32 GMT+9 from Cursor (3.4.20)_

---

**User**

C:\Users\winmev\Desktop\dev\myHome>git push
remote: Permission to simulavi/main.git denied to moonIsMyFriend.
fatal: unable to access 'https://github.com/simulavi/main.git/': The requested URL returned error: 403
에러나는데 다른계정으로 실행되도록 할 수 있어. 여기 폴더만

---

**Cursor**

이 폴더의 Git 원격·인증 설정을 확인한 뒤, 다른 계정만 쓰도록 로컬 설정을 맞추겠습니다.


원인: Windows 자격 증명에 `moonIsMyFriend`가 `github.com` 전체에 저장되어 있습니다. 이 저장소만 `simulavi` 계정을 쓰도록 로컬 설정을 적용합니다.


`myHome` 폴더에만 **simulavi** 계정을 쓰도록 로컬 Git 설정을 적용해 두었습니다.

## 원인

Windows 자격 증명 관리자에 `moonIsMyFriend`가 `github.com` 전체용으로 저장되어 있어서, `simulavi/main` 저장소에도 그 계정으로 push가 시도되었습니다.

## 적용한 설정 (이 폴더만)

`C:\Users\winmev\Desktop\dev\myHome`에서:

1. **원격 URL에 계정명 포함**
   - `https://github.com/simulavi/main.git` → `https://simulavi@github.com/simulavi/main.git`

2. **저장소별 자격 증명 분리**
   - `credential.useHttpPath = true` — URL 경로마다 다른 계정 저장
   - `credential.username = simulavi`

다른 프로젝트 폴더는 기존 `moonIsMyFriend` 설정을 그대로 씁니다.

## 다음 단계

터미널에서 `myHome` 폴더로 가서 push 하세요:

```powershell
cd C:\Users\winmev\Desktop\dev\myHome
git push
```

Git Credential Manager 창이나 브라우저 로그인이 뜨면 **simulavi** 계정으로 로그인하세요. (2FA 사용 시 **Personal Access Token**이 필요할 수 있습니다.)

커밋 작성자 이름/이메일도 이 저장소만 바꾸려면:

```powershell
git config --local user.name "원하는이름"
git config --local user.email "simulavi계정이메일@example.com"
```

## 여전히 403이면

전역 자격 증명이 우선될 때입니다. 아래로 **이 저장소 경로만** 지운 뒤 다시 push 하세요:

```powershell
cmdkey /list | findstr github
# simulavi/main 관련 항목이 있으면 해당 target으로:
# cmdkey /delete:LegacyGeneric:target=git:https://github.com/simulavi/main.git
```

또는 SSH로 전환하는 방법도 있습니다(폴더별 SSH 키 지정). 그쪽이 필요하면 알려주세요.

---

지금 로컬에 push 대기 중인 커밋 1개(`0817599`)가 있습니다. 로그인 창이 떴다면 **simulavi**로 인증을 완료하면 push가 됩니다. GitHub 계정명이 `simulavi`가 아니라면 알려주시면 URL/username만 맞춰 드리겠습니다.

---

**User**

<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: aborted
task_id: 182695
title: Test git push with new per-repo credentials
output_path: C:\Users\winmev\.cursor\projects\c-Users-winmev-Desktop-dev-learnlang-server\terminals\182695.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

`myHome` 저장소만 **simulavi** 계정을 쓰도록 로컬 설정을 적용해 두었습니다.

- 원격 URL: `https://simulavi@github.com/simulavi/main.git`
- `credential.useHttpPath` + `credential.username = simulavi` (이 폴더만)

다른 프로젝트는 기존 `moonIsMyFriend` 설정 그대로입니다.

`git push`는 로그인 창 대기 중 중단되었습니다. `myHome` 폴더에서 다시 `git push` 하시고, 뜨는 창에서 **simulavi** 계정으로 로그인하시면 됩니다. 로컬에 push 대기 중인 커밋 1개가 있습니다.

