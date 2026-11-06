import { redirect } from 'next/navigation';
/** 서버 없이도 팀원이 현재 업무 흐름을 확인할 수 있는 합성 시연을 기본으로 연다. */
export default function HomePage() {
  redirect('/starter');
}
