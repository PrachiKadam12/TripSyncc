import { useState } from 'react';
import { useTrip } from '../../context/TripContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { trips, BUDGET, traveler } from '../../data/demoTrip.js';
import { computeFinance } from '../../utils/finance.js';
import FinanceTabs, { FinanceStat, TripFinanceRow } from '../../components/FinanceTabs.jsx';
import PersonalExpenseCard from '../../components/expenses/PersonalExpenseCard.jsx';
import GroupExpenseLedger from '../../components/expenses/GroupExpenseLedger.jsx';
import { formatInr, formatInr as INR } from '../../utils/finance.js';
import { Plane } from 'lucide-react';

function DemoFinancePage() {
  const { state } = useTrip();
  const [tab, setTab] = useState('ongoing');
  const f = computeFinance(state);

  const ongoingCount = 1;
  const upcomingCount = trips.upcoming.length;
  const completedCount = trips.completed.length;

  const tabContent = {
    ongoing: (
      <div className="space-y-6">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white font-extrabold text-lg">
              {traveler.name[0]}
            </div>
            <div>
              <p className="text-base font-extrabold text-navy">{traveler.name}</p>
              <p className="text-xs text-ink-soft">Current trip · Budget: {INR(BUDGET)}</p>
            </div>
          </div>
        </div>

        <PersonalExpenseCard />
        <GroupExpenseLedger />

        <div className="card p-5">
          <h3 className="text-base font-bold text-navy mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-primary" />
            Trip financial summary
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceStat icon={() => <span className="text-xl font-extrabold text-primary">₹</span>} label="Total budget" value={formatInr(f.budget)} sub="Approved trip budget" tone="navy" delay={0} />
            <FinanceStat icon={() => <span className="text-xl font-extrabold text-ink-soft">↓</span>} label="Spent so far" value={INR(f.spent)} sub={state.phase === 'recovered' ? 'Includes recovery cost' : 'All bookings paid'} tone={f.spent > BUDGET * 0.8 ? 'attention' : 'navy'} delay={0.05} />
            <FinanceStat icon={() => <span className="text-xl font-extrabold text-emerald">↑</span>} label="Money saved" value={f.saved ? INR(f.saved) : '₹0'} sub="Refund from recovery" tone={f.saved > 0 ? 'emerald' : 'navy'} delay={0.1} />
            <FinanceStat icon={() => <span className="text-xl font-extrabold text-attention">↑</span>} label="Money lost" value={f.lost ? INR(f.lost) : '₹0'} sub={f.lost > 0 ? 'Recovery extra cost' : 'No extra cost'} tone={f.lost > 0 ? 'attention' : 'emerald'} delay={0.15} />
          </div>

          <div className="mt-4 rounded-xl bg-white border border-navy/5 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-ink-faint mb-2">
              <span>Budget usage</span>
              <span>{INR(f.spent)} of {INR(f.budget)} spent ({Math.round((f.spent / f.budget) * 100)}%)</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-periwinkle">
              <div
                className={`h-full rounded-full transition-all duration-500 ${(f.spent / f.budget) > 0.8 ? 'bg-attention' : (f.spent / f.budget) > 0.5 ? 'bg-primary' : 'bg-emerald'}`}
                style={{ width: `${Math.min(100, (f.spent / f.budget) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    ),
    upcoming: (
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Trips you're planning.</p>
        {trips.upcoming.map((t, i) => <TripFinanceRow key={t.id} trip={t} showDeadline delay={i * 0.05} />)}
      </div>
    ),
    completed: (
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Past trips.</p>
        {trips.completed.map((t, i) => <TripFinanceRow key={t.id} trip={t} delay={i * 0.05} />)}
      </div>
    ),
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Finance</h1>
        <p className="mt-1 text-sm text-ink-soft">Track your trip spending — ongoing, upcoming, and completed.</p>
      </header>
      <FinanceTabs trips={{ ongoingTotal: ongoingCount }} activeTab={tab} onTabChange={setTab}>
        {tabContent[tab]}
      </FinanceTabs>
    </div>
  );
}

function RealFinancePage() {
  const { activeTrip, realTrips } = useTrip();
  const { displayName } = useAuth();
  const [tab, setTab] = useState('ongoing');

  const upcomingTrips = realTrips.filter(t => t.status === 'planned');
  const completedTrips = realTrips.filter(t => t.status === 'completed');

  const activeBudget = activeTrip ? (activeTrip.bookings || []).reduce((s, b) => s + (parseFloat(b.base_amount) || 0), 0) : 0;
  // Fallback budget if 0 booked
  const budgetLimit = activeBudget > 0 ? activeBudget * 1.2 : 50000;

  const tabContent = {
    ongoing: (
      <div className="space-y-6">
        {!activeTrip ? (
          <div className="card p-8 text-center text-ink-soft">
            <Plane size={48} className="mx-auto text-sky-200 mb-4" />
            <p>No active trips to track spending for.</p>
          </div>
        ) : (
          <>
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white font-extrabold text-lg">
                  {displayName?.[0] || 'T'}
                </div>
                <div>
                  <p className="text-base font-extrabold text-navy">{displayName}</p>
                  <p className="text-xs text-ink-soft">{activeTrip.name} · Spent: {INR(activeBudget)}</p>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-base font-bold text-navy mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-primary" />
                Trip financial summary
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FinanceStat icon={() => <span className="text-xl font-extrabold text-primary">₹</span>} label="Estimated Budget" value={formatInr(budgetLimit)} sub="Total trip allowance" tone="navy" delay={0} />
                <FinanceStat icon={() => <span className="text-xl font-extrabold text-ink-soft">↓</span>} label="Spent so far" value={INR(activeBudget)} sub={`${activeTrip.bookings?.length || 0} bookings paid`} tone={activeBudget > budgetLimit * 0.8 ? 'attention' : 'navy'} delay={0.05} />
                <FinanceStat icon={() => <span className="text-xl font-extrabold text-emerald">↑</span>} label="Money saved" value="₹0" sub="No refunds yet" tone="navy" delay={0.1} />
                <FinanceStat icon={() => <span className="text-xl font-extrabold text-attention">↑</span>} label="Money lost" value="₹0" sub="No extra costs" tone="emerald" delay={0.15} />
              </div>

              <div className="mt-4 rounded-xl bg-white border border-navy/5 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-ink-faint mb-2">
                  <span>Budget usage</span>
                  <span>{INR(activeBudget)} of {INR(budgetLimit)} spent</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-periwinkle">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${(activeBudget / budgetLimit) > 0.8 ? 'bg-attention' : 'bg-emerald'}`}
                    style={{ width: `${Math.min(100, (activeBudget / budgetLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    ),
    upcoming: (
      <div className="space-y-4">
        {upcomingTrips.length === 0 ? <p className="text-sm text-ink-soft">No upcoming trips.</p> : upcomingTrips.map(t => (
          <div key={t.id} className="card p-4">
            <h4 className="font-bold text-navy">{t.name}</h4>
            <p className="text-xs text-ink-soft">{new Date(t.start_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    ),
    completed: (
      <div className="space-y-4">
        {completedTrips.length === 0 ? <p className="text-sm text-ink-soft">No completed trips yet.</p> : completedTrips.map(t => (
           <div key={t.id} className="card p-4">
           <h4 className="font-bold text-navy">{t.name}</h4>
           <p className="text-xs text-ink-soft">{new Date(t.end_at).toLocaleDateString()}</p>
         </div>
        ))}
      </div>
    ),
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Finance</h1>
        <p className="mt-1 text-sm text-ink-soft">Track your trip spending — ongoing, upcoming, and completed.</p>
      </header>
      <FinanceTabs trips={{ ongoingTotal: activeTrip ? 1 : 0 }} activeTab={tab} onTabChange={setTab}>
        {tabContent[tab]}
      </FinanceTabs>
    </div>
  );
}

export default function FinancePage() {
  const { isDemoUser } = useTrip();
  return isDemoUser ? <DemoFinancePage /> : <RealFinancePage />;
}
