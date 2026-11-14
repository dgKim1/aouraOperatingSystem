'use client';
/**
 * S-02 사건 입력 양식 — POST /api/events. 원본 접수(갱신 통보 · 확대 기안)와 모의 사건(회수 지연 · 조건 정정 · 외부 회신)을 같은 방식으로 넣는다.
 * 검증은 서버가 최종 판정한다(필수값 · 과거 날짜 · 없는 ID → 422/409/404 문구 그대로).
 * 제출 후 결과 패널: 상태 변경 · 생성 작업 · 권한자 변경 · 새 판단안 필요 + [AI 판단안 만들기].
 */
import { useState } from 'react';
import { Inbox } from 'lucide-react';
import type { EventResponse } from '@/domain/api-types';
import type { SourceLabel } from '@/domain/types';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { AssessButton } from '@/components/mutation/assessment-actions';
import { useApiAction } from '@/components/mutation/api-client';
import { CounterpartyReplyForm } from '@/components/mutation/counterparty-reply-form';
import { ApiErrorBox, ResultPanel } from '@/components/mutation/result-panel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface LineOption {
  id: string;
  text: string;
}

function Card({ title, label, children }: { title: string; label: SourceLabel; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-xs" aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {title} <SourceBadgeStatic label={label} />
      </h3>
      {children}
    </section>
  );
}

/** 결과 패널 + 새 판단안이 필요한 대상에 [AI 판단안 만들기] */
function EventResult({ r, onClose, aiMode }: { r: EventResponse; onClose: () => void; aiMode: 'LIVE' | 'MOCK' }) {
  // ID 체계(계약 CTR- · 기안 건 PLAN-)로 판단안 대상 유형만 나눈다 — 무엇이 필요한지는 서버가 정함
  const contracts = r.needsAssessment.filter((id) => id.startsWith('CTR-'));
  const lines = r.needsAssessment.filter((id) => id.startsWith('PLAN-'));
  return (
    <ResultPanel
      title={`사건 ${r.event.id} (${r.event.type}) 처리 결과`}
      result={r}
      onClose={onClose}
      extra={
        (contracts.length > 0 || lines.length > 0) && (
          <div className="space-y-2 rounded border border-blue-200 bg-white p-2">
            <p className="text-xs font-semibold text-blue-900">새 판단안이 필요합니다</p>
            {contracts.map((c) => (
              <AssessButton key={c} subjectType="CONTRACT" subjectIds={[c]} label={`계약 ${c} 판단안 만들기`} aiMode={aiMode} />
            ))}
            {lines.length > 0 && <AssessButton subjectType="EXPANSION_LINES" subjectIds={lines} label={`기안 ${lines.length}건 판단안 만들기`} aiMode={aiMode} />}
          </div>
        )
      }
    />
  );
}

function SimpleEvent({ title, label, body, submitLabel, aiMode, children, disabledReason }: { title: string; label: SourceLabel; body: () => unknown; submitLabel: string; aiMode: 'LIVE' | 'MOCK'; children?: React.ReactNode; disabledReason?: string | null }) {
  const act = useApiAction<EventResponse>();
  return (
    <Card title={title} label={label}>
      <form
        className="space-y-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          act.run('/api/events', 'POST', body());
        }}
      >
        {children}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={act.pending || !!disabledReason}>
            <Inbox className="size-3.5" aria-hidden /> {act.pending ? '처리 중…' : submitLabel}
          </Button>
          {disabledReason && <span className="text-xs text-zinc-600">{disabledReason}</span>}
        </div>
      </form>
      <div className="mt-2 space-y-2">
        {act.error && <ApiErrorBox error={act.error} />}
        {act.result && <EventResult r={act.result} onClose={act.reset} aiMode={aiMode} />}
      </div>
    </Card>
  );
}

export function EventForms({ contractId, contractStatusText, received, lines, aiMode, today }: { contractId: string; contractStatusText: string; received: boolean; lines: LineOption[]; aiMode: 'LIVE' | 'MOCK'; today: string }) {
  const [arId, setArId] = useState('MAR-0004');
  const [newDue, setNewDue] = useState('');
  const [lineId, setLineId] = useState(lines[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [settle, setSettle] = useState('');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SimpleEvent title="갱신 통보 접수" label="ORIGINAL" submitLabel="통보 접수" aiMode={aiMode} body={() => ({ type: 'RENEWAL_NOTICE_RECEIVED', payload: { contractId } })}>
        <p>
          계약 <span className="font-mono">{contractId}</span> — 원본 <span className="font-mono text-xs">inf001_exclusive_contract_notice.md</span>
        </p>
        <p className="text-xs text-zinc-600">현재 상태: {contractStatusText}</p>
      </SimpleEvent>

      <SimpleEvent title="확대 기안 접수" label="ORIGINAL" submitLabel="기안 접수" aiMode={aiMode} body={() => ({ type: 'EXPANSION_PROPOSAL_RECEIVED', payload: { proposalId: 'PROP-2026-07' } })} disabledReason={received ? '이미 접수됨' : null}>
        <p>
          기안 <span className="font-mono">PROP-2026-07</span> — 원본 <span className="font-mono text-xs">mkt_budget_plan_ms.csv</span> 25건 전체
        </p>
        <p className="text-xs text-zinc-600">건 범위 선택(기한별 부분 접수)은 API 가 전체 접수만 받아 두지 않았습니다.</p>
      </SimpleEvent>

      <SimpleEvent title="회수 지연 통보" label="MOCK" submitLabel="회수 지연 입력 (모의)" aiMode={aiMode} body={() => ({ type: 'AR_COLLECTION_DELAYED', payload: { arId, newDueDate: newDue } })}>
        <div className="grid grid-cols-[6rem_1fr] items-center gap-2">
          <Label htmlFor="ev-ar">AR ID</Label>
          <input id="ev-ar" className="h-8 w-40 rounded border px-2 font-mono" value={arId} onChange={(e) => setArId(e.target.value)} required aria-describedby="ev-ar-help" />
          <Label htmlFor="ev-due">새 만기일</Label>
          <input id="ev-due" type="date" min={today} className="h-8 w-44 rounded border px-2" value={newDue} onChange={(e) => setNewDue(e.target.value)} required />
        </div>
        <p id="ev-ar-help" className="text-xs text-zinc-600">
          ② 시연: MAR-0004 (CH-03 · 원 만기 2026-08-23) → 2026-08-30. 맥락 원본 <span className="font-mono">lc0001_payment_term_notice.md</span>. 지연 통보 자체는 모의.
        </p>
      </SimpleEvent>

      <SimpleEvent
        title="기안 조건 정정"
        label="MOCK"
        submitLabel="정정 입력 (모의)"
        aiMode={aiMode}
        disabledReason={lines.length === 0 ? '기안 미접수' : null}
        body={() => ({ type: 'LINE_TERMS_CHANGED', payload: { lineId, ...(amount ? { requestedKrw: Number(amount) } : {}), ...(settle ? { settlementDate: settle } : {}) } })}
      >
        <div className="grid grid-cols-[6rem_1fr] items-center gap-2">
          <Label htmlFor="ev-line">건</Label>
          <select id="ev-line" className="h-8 rounded border bg-white px-2" value={lineId} onChange={(e) => setLineId(e.target.value)}>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.text}
              </option>
            ))}
          </select>
          <Label htmlFor="ev-amt">요청액 (원)</Label>
          <input id="ev-amt" type="number" min={1} step={1} className="h-8 w-44 rounded border px-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Label htmlFor="ev-set">집행일</Label>
          <input id="ev-set" type="date" min={today} className="h-8 w-44 rounded border px-2" value={settle} onChange={(e) => setSettle(e.target.value)} />
        </div>
        <p className="text-xs text-zinc-600">요청액 · 집행일 중 하나 이상 (없으면 서버가 422 로 돌려보냄). 권한자 재판정은 서버(R-AUTH-06).</p>
      </SimpleEvent>

      <div className="lg:col-span-2">
        <Card title="외부 회신" label="MOCK">
          <p className="mb-2 text-xs text-zinc-600">
            에이전시 · SCM · Corevia 회신을 넣습니다. 처리 규칙은 SCREEN_SPEC 4-1 (수령확인 → 계약 수령 확인 / 정보 제공 · 정보 부족 → 정보 요청 작업 종료 / SCM 보충 필요 여부 → 보충요청 상신 · 종결 / 거절 → 관련 작업 종결). 맞는 열린 작업이 없으면 서버가 404 를 돌려줍니다.
          </p>
          <CounterpartyReplyForm compact />
        </Card>
      </div>
    </div>
  );
}
