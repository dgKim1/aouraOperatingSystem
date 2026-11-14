import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="rounded-md border bg-white p-6 text-sm">
      <p className="font-semibold">찾을 수 없습니다 (404)</p>
      <p className="mt-1 text-zinc-700">존재하지 않는 ID 이거나, 현재 시연 상태에서 아직 만들어지지 않은 항목입니다.</p>
      <Link href="/" className="mt-2 inline-block underline">운영 현황으로</Link>
    </div>
  );
}
