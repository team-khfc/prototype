'use client';

import { Fragment, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sessionSchema, type Session } from './types';
import { ROLE_LABELS } from '@/lib/sharedTypes';
import { ApiError, requestJson, SESSION_EXPIRED_EVENT, invalidateIdentity } from '@/lib/http';
import { activateDraftScope } from '@/lib/draft';
import { useLoginMutation, useExtendSessionMutation, useLogoutMutation } from './useAuthentication';
import { ErrorNotice, Loading, Modal, Icon, Notice } from '@/components/ui';

const AuthContext = createContext<Session | null>(null);
/** 서버 세션만 역할·기관 표시의 근거로 사용한다. 인증 경계 밖에서 호출하면 Error를 던진다.
 * @throws Error 인증된 업무 경계가 없을 때 */
export function useSession(): Session {
  const session = useContext(AuthContext);
  if (!session) throw new Error('인증된 업무 화면에서만 사용할 수 있습니다.');
  return session;
}
/** 역할 선택으로 인증을 대체하지 않고 실제 로그인 응답이 성공한 뒤에만 업무 화면을 연다. */
export function LoginForm({
  onSuccess,
  expired = false,
}: {
  onSuccess?: (session: Session) => void;
  expired?: boolean;
}) {
  const authentication = useLoginMutation();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const session = await authentication.mutateAsync({ username, password });
      setPassword('');
      if (onSuccess) onSuccess(session);
      else router.replace('/security-requests');
    } catch (failure) {
      setError(failure);
      setPassword('');
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={login} className="sa-login-form">
      <div className="sa-login-mark">
        <Icon name="shield" width={32} height={32} />
      </div>
      <h1>{expired ? '로그인을 다시 확인해 주세요' : '보안길잡이 로그인'}</h1>
      <p>시연 기관의 계정으로 업무 공간에 접속합니다. 실제 개인정보는 입력하지 마세요.</p>
      <ErrorNotice error={error} />
      <div className="sa-field">
        <label htmlFor="username">
          아이디 <span className="sa-required">필수</span>
        </label>
        <input
          id="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={120}
          disabled={pending}
        />
      </div>
      <div className="sa-field">
        <label htmlFor="password">
          비밀번호 <span className="sa-required">필수</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={200}
          disabled={pending}
        />
      </div>
      <button className="sa-button sa-primary sa-full" type="submit" disabled={pending}>
        {pending ? '로그인 확인 중…' : '로그인'}
        <Icon name="arrow" />
      </button>
      <p className="sa-login-hint">역할과 기관은 인증된 서버 계정에 따라 결정됩니다.</p>
      {!expired && (
        <Link className="sa-text-button" href="/signup">
          일반 사용자로 회원가입
        </Link>
      )}
      {!expired && (
        <Link className="sa-text-button" href="/starter">
          로그인 없이 합성 데이터로 시연하기
          <Icon name="arrow" />
        </Link>
      )}
    </form>
  );
}

/** 세션 만료는 재인증으로 처리하되 같은 계정의 미저장 입력을 복구할 수 있게 경계를 유지한다. */
export function AuthBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: ({ signal }) => requestJson('/auth/session', sessionSchema, { signal }),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const [expired, setExpired] = useState(false);
  const [authenticationVersion, setAuthenticationVersion] = useState(0);
  const [seconds, setSeconds] = useState(Infinity);
  const extension = useExtendSessionMutation();
  const extending = extension.isPending;
  const [extendError, setExtendError] = useState<unknown>();
  const session = sessionQuery.data;
  useEffect(() => {
    if (!session) return;
    activateDraftScope(`${session.user.institutionId}:${session.user.userId}`);
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSeconds(remaining);
      if (remaining === 0) setExpired(true);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);
  useEffect(() => {
    const handle = () => {
      invalidateIdentity();
      setExpired(true);
      queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handle);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handle);
  }, [queryClient]);
  async function extend() {
    setExtendError(undefined);
    try {
      await extension.mutateAsync();
      setExpired(false);
    } catch (failure) {
      setExtendError(failure);
      if (failure instanceof ApiError && failure.status === 401) setExpired(true);
    }
  }
  if (sessionQuery.isPending)
    return (
      <div className="sa-login-page">
        <Loading label="로그인 정보를 확인하고 있습니다." />
      </div>
    );
  if (!session)
    return (
      <div className="sa-login-page">
        {sessionQuery.error instanceof ApiError && sessionQuery.error.status !== 401 && (
          <ErrorNotice error={sessionQuery.error} retry={() => void sessionQuery.refetch()} />
        )}
        <LoginForm
          onSuccess={() => {
            setExpired(false);
            void sessionQuery.refetch();
          }}
        />
      </div>
    );
  return (
    <AuthContext value={session}>
      <Fragment
        key={`${session.user.institutionId}:${session.user.userId}:${authenticationVersion}`}
      >
        {children}
      </Fragment>
      <Modal
        open={expired || seconds <= 60}
        title={expired ? '로그인 시간이 만료되었습니다' : '로그인 시간 연장'}
        onClose={() => undefined}
        locked
      >
        {expired ? (
          <>
            <Notice>
              편집하던 입력은 이 탭의 메모리에 보관됩니다. 같은 계정으로 다시 로그인하면 이어서
              작성할 수 있습니다.
            </Notice>
            <LoginForm
              expired
              onSuccess={(next) => {
                setAuthenticationVersion((value) => value + 1);
                setExpired(false);
                setSeconds(Math.floor((new Date(next.expiresAt).getTime() - Date.now()) / 1000));
              }}
            />
          </>
        ) : (
          <>
            <p>
              자동 로그아웃까지 <strong>{seconds}초</strong> 남았습니다. 계속 작업하려면 로그인
              시간을 연장해 주세요.
            </p>
            <ErrorNotice error={extendError} />
            <div className="sa-dialog-actions">
              <button
                className="sa-button sa-primary"
                type="button"
                onClick={() => void extend()}
                disabled={extending}
              >
                {extending ? '연장 확인 중…' : '로그인 시간 연장'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </AuthContext>
  );
}

/** 서버 로그아웃이 확인된 이후에만 계정별 캐시와 휘발성 초안을 폐기한다. */
export function AccountControl() {
  const session = useSession();
  const logoutMutation = useLogoutMutation();
  const router = useRouter();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    setError(undefined);
    try {
      await logoutMutation.mutateAsync();
      router.replace('/login');
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <span className="sa-account-role">{ROLE_LABELS[session.user.role]}</span>
      <span className="sa-avatar" aria-hidden="true">
        {session.user.displayName.slice(0, 1)}
      </span>
      <span className="sa-account-name">{session.user.displayName}</span>
      <button
        className="sa-text-button"
        type="button"
        onClick={() => void logout()}
        disabled={pending}
      >
        로그아웃
      </button>
      {error && (
        <Modal open title="로그아웃 확인" onClose={() => setError(undefined)}>
          <ErrorNotice error={error} />
        </Modal>
      )}
    </>
  );
}
