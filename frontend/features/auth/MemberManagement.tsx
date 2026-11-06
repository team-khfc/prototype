'use client';

import { useState } from 'react';
import { Empty, ErrorNotice, Icon, Loading } from '@/components/ui';
import { ROLE_LABELS, type Role } from '@/lib/sharedTypes';
import { useSession } from './Authentication';
import { useChangeMemberRole, useMembers } from './useMembers';
import type { ChangeMemberRoleInput, Member } from './types';

/** 편집 시작 시의 revision을 보존해 다른 관리자의 역할 변경을 덮어쓰지 않는다. */
export function MemberRoleForm({
  member,
  pending,
  save,
  cancel,
}: {
  member: Member;
  pending: boolean;
  save: (input: ChangeMemberRoleInput) => Promise<unknown>;
  cancel: () => void;
}) {
  const [role, setRole] = useState<Role>(member.role);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="sa-card sa-settings-form"
      aria-label="회원 역할 변경"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(undefined);
        setSaved(false);
        try {
          if (!reason.trim()) throw new Error('역할 변경 사유를 입력해 주세요.');
          await save({
            id: member.id,
            expectedRevision: member.revision,
            role,
            reason: reason.trim(),
          });
          setSaved(true);
        } catch (failure) {
          setError(failure);
        }
      }}
    >
      <div className="sa-section-heading">
        <h2>{member.displayName} 역할 변경</h2>
        <span className="sa-badge sa-neutral">기준 v{member.revision}</span>
      </div>
      <p className="sa-muted">
        {member.username} · {member.department || '부서 미입력'} · 현재 {ROLE_LABELS[member.role]}
      </p>
      <ErrorNotice error={error} />
      {saved && (
        <p className="sa-save-feedback" role="status">
          서버에서 역할 변경을 완료했습니다. 다음 요청부터 새 권한을 확인합니다.
        </p>
      )}
      <div className="sa-field">
        <label htmlFor="member-role">
          변경할 역할 <span className="sa-required">필수</span>
        </label>
        <select
          id="member-role"
          value={role}
          disabled={pending || saved}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="sa-field">
        <label htmlFor="member-role-reason">
          변경 사유 <span className="sa-required">필수</span>
        </label>
        <textarea
          id="member-role-reason"
          required
          maxLength={500}
          rows={3}
          value={reason}
          disabled={pending || saved}
          onChange={(event) => setReason(event.target.value)}
          placeholder="역할 변경 이유를 작성해 주세요."
        />
      </div>
      <div className="sa-callout">
        <Icon name="shield" />
        <p>기관 범위·관리자 권한·수정본 검증은 서버가 수행하고 변경 이력에 사유를 남깁니다.</p>
      </div>
      <div className="sa-form-actions">
        <button type="button" className="sa-button sa-tertiary" onClick={cancel} disabled={pending}>
          {saved ? '목록으로' : '편집 닫기'}
        </button>
        <button
          type="submit"
          className="sa-button sa-primary"
          disabled={pending || saved || role === member.role || !reason.trim()}
        >
          {pending ? '변경 중…' : '역할 변경'}
        </button>
      </div>
      {!!error && (
        <p className="sa-field-help">
          최신 역할을 확인하려면 편집을 닫고 목록을 다시 불러온 후 해당 회원을 선택해 주세요.
        </p>
      )}
    </form>
  );
}
/** 실제 계정의 역할 관리는 공개 시연 역할 선택과 분리된 관리자 API에 연결한다. */
export function MemberManagement() {
  const { user } = useSession();
  const members = useMembers();
  const change = useChangeMemberRole();
  const [selected, setSelected] = useState<Member>();
  if (user.role !== 'ADMIN')
    return (
      <Empty
        title="기관 관리자만 회원을 관리할 수 있습니다"
        description="역할 부여나 변경은 기관 관리자에게 요청해 주세요."
      />
    );
  return (
    <div className="sa-settings-stack">
      <section className="sa-card">
        <div className="sa-section-heading">
          <h2>기관 회원</h2>
          <button
            className="sa-text-button"
            onClick={() => void members.refetch()}
            disabled={members.isFetching}
          >
            목록 새로고침
          </button>
        </div>
        {members.isPending ? (
          <Loading />
        ) : members.error ? (
          <ErrorNotice error={members.error} retry={() => void members.refetch()} />
        ) : !members.data?.length ? (
          <Empty
            title="등록된 회원이 없습니다"
            description="회원가입을 완료한 계정이 이곳에 표시됩니다."
          />
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-management-table">
              <caption className="sr-only">같은 기관 회원의 역할과 계정 상태</caption>
              <thead>
                <tr>
                  <th scope="col">회원</th>
                  <th scope="col">부서</th>
                  <th scope="col">역할</th>
                  <th scope="col">상태</th>
                  <th scope="col">관리</th>
                </tr>
              </thead>
              <tbody>
                {members.data.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.displayName}</strong>
                      <small>
                        {member.username}
                        {member.id === user.userId && ' · 내 계정'}
                      </small>
                    </td>
                    <td>{member.department || '미입력'}</td>
                    <td>{ROLE_LABELS[member.role]}</td>
                    <td>{member.active ? '사용 중' : '비활성'}</td>
                    <td>
                      <button
                        className="sa-button sa-tertiary"
                        disabled={!member.active || change.isPending}
                        onClick={() => setSelected(member)}
                        aria-label={`${member.displayName} 역할 변경`}
                      >
                        역할 변경
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <MemberRoleForm
          key={`${selected.id}:${selected.revision}`}
          member={selected}
          pending={change.isPending}
          save={(input) => change.mutateAsync(input)}
          cancel={() => setSelected(undefined)}
        />
      )}
    </div>
  );
}
