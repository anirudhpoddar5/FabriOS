import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, CalendarDays, ClipboardList, Save, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Attendance } from '@/types';

const EMPTY_ATTENDANCE: Attendance[] = [];

interface AttendanceRow {
  workerId: string;
  employeeCode: string;
  workerName: string;
  workerTypeName: string;
  factoryId: string;
  shiftId: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  overtimeHours: number;
  status: 'present' | 'absent' | 'leave';
  notes: string;
  existingId?: string;
}

const emptyRow = (worker: any): AttendanceRow => ({
  workerId: worker.id,
  employeeCode: worker.employeeCode,
  workerName: worker.name,
  workerTypeName: '',
  factoryId: worker.factoryId,
  shiftId: '',
  checkIn: '',
  checkOut: '',
  hoursWorked: 0,
  overtimeHours: 0,
  status: 'present',
  notes: '',
});

function computeHours(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  if (isNaN(ih) || isNaN(oh)) return 0;
  const hours = oh - ih + (om - im) / 60;
  return hours > 0 ? Math.round(hours * 100) / 100 : 0;
}

export default function AttendancePage() {
  const { profile, currentModule } = useAuth();
  const companyId = profile?.company_id;
  const { data: appData, currentFactoryId } = useData();
  const qc = useQueryClient();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  const showP = currentModule === 'printing' || currentModule === 'both';
  const showS = currentModule === 'stitching' || currentModule === 'both';

  // Memoized: an unstable reference here (recreated every render) cascades into
  // factoryWorkers below (which depends on it) and retriggers the loadRows()
  // effect on every render, resetting in-progress row edits before they can
  // be typed (see loadRows effect further down).
  const factories = useMemo(() => appData.factories.filter((f: any) =>
    f.active !== false && (f.type === currentModule || f.type === 'mixed' || !currentModule)
  ), [appData.factories, currentModule]);

  // Shifts for the selected factory
  const factoryWorkers = useMemo(() => {
    const factoryId = currentFactoryId || (factories.length > 0 ? factories[0].id : null);
    if (!factoryId) return [];
    return appData.workers.filter((w: any) => w.active !== false && w.factoryId === factoryId);
  }, [appData.workers, currentFactoryId, factories]);

  const workerTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    appData.workerTypes.forEach((wt: any) => { map[wt.id] = wt.name; });
    return map;
  }, [appData.workerTypes]);

  const shiftsList = useMemo(() => {
    const factoryId = currentFactoryId || (factories.length > 0 ? factories[0].id : null);
    if (!factoryId) return [];
    return appData.shifts.filter((s: any) => s.active !== false && s.factoryId === factoryId);
  }, [appData.shifts, currentFactoryId, factories]);

  const { data: existingAttendanceRaw } = useQuery({
    queryKey: ['attendance', companyId, date, currentFactoryId],
    queryFn: async () => {
      if (!companyId) return [];
      let query = supabase.from('attendance').select('*').eq('company_id', companyId).eq('date', date);
      if (currentFactoryId) {
        const { data: factWorkers } = await supabase.from('workers').select('id').eq('company_id', companyId).eq('factory_id', currentFactoryId);
        const workerIds = (factWorkers || []).map((w: any) => w.id);
        if (workerIds.length > 0) query = query.in('worker_id', workerIds);
        else return [];
      }
      const { data } = await query;
      return (data || []).map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        workerId: r.worker_id,
        date: r.date,
        shiftId: r.shift_id,
        checkIn: r.check_in,
        checkOut: r.check_out,
        hoursWorked: r.hours_worked,
        overtimeHours: r.overtime_hours,
        status: r.status,
        notes: r.notes,
      })) as Attendance[];
    },
    enabled: !!companyId,
  });
  // `data` is undefined until the query resolves; a `= []` default on the
  // destructure above would create a brand-new array every render, which
  // (as a dependency of the loadRows effect below) causes an infinite
  // render loop that resets in-progress row edits on every keystroke.
  const existingAttendance = useMemo(() => existingAttendanceRaw ?? EMPTY_ATTENDANCE, [existingAttendanceRaw]);

  const loadRows = () => {
    const existing = existingAttendance as Attendance[];
    const existingMap = new Map(existing.map((e: Attendance) => [e.workerId, e]));
    const newRows = factoryWorkers.map((w: any) => {
      const existing = existingMap.get(w.id);
      if (existing) {
        return {
          workerId: w.id,
          employeeCode: w.employeeCode,
          workerName: w.name,
          workerTypeName: workerTypeMap[w.workerTypeId] || '',
          factoryId: w.factoryId,
          shiftId: existing.shiftId || '',
          checkIn: existing.checkIn || '',
          checkOut: existing.checkOut || '',
          hoursWorked: existing.hoursWorked || 0,
          overtimeHours: existing.overtimeHours || 0,
          status: existing.status,
          notes: existing.notes || '',
          existingId: existing.id,
        };
      }
      return emptyRow(w);
    });
    setRows(newRows);
  };

  useEffect(() => { loadRows(); }, [existingAttendance, factoryWorkers, workerTypeMap]);

  const updateRow = (idx: number, field: keyof AttendanceRow, value: any) => {
    setRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'checkIn' || field === 'checkOut') {
        updated[idx].hoursWorked = computeHours(
          field === 'checkIn' ? value : updated[idx].checkIn,
          field === 'checkOut' ? value : updated[idx].checkOut,
        );
      }
      return updated;
    });
  };

  const markAllPresent = () => {
    setRows(prev => prev.map(r => ({ ...r, status: 'present' as const })));
  };

  const saveAttendance = useMutation({
    mutationFn: async () => {
      setSaving(true);
      const validRows = rows.filter(r => r.status);
      for (const row of validRows) {
        const { existingId, employeeCode, workerName, workerTypeName, ...data } = row;
        const payload: Record<string, any> = {
          company_id: companyId,
          worker_id: row.workerId,
          date,
          shift_id: row.shiftId || null,
          check_in: row.checkIn || null,
          check_out: row.checkOut || null,
          hours_worked: row.hoursWorked || null,
          overtime_hours: row.overtimeHours || 0,
          status: row.status,
          notes: row.notes || null,
        };
        Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

        if (row.existingId) {
          const { error } = await supabase.from('attendance').update(payload).eq('id', row.existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('attendance').insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance_report'] });
      toast.success('Attendance saved');
      setSaving(false);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setSaving(false);
    },
  });

  const { data: reportData = [] } = useQuery({
    queryKey: ['attendance_report', companyId, reportMonth, currentFactoryId],
    queryFn: async () => {
      if (!companyId) return [];
      const startDate = `${reportMonth}-01`;
      const endDate = `${reportMonth}-31`;
      let query = supabase
        .from('attendance')
        .select('*, workers!inner(name, employee_code, factory_id)')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate);
      if (currentFactoryId) {
        query = query.eq('workers.factory_id', currentFactoryId);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!companyId,
  });

  const monthlySummary = useMemo(() => {
    const byWorker: Record<string, { name: string; code: string; totalHours: number; overtimeHours: number; present: number; absent: number; leave: number; count: number }> = {};
    for (const r of reportData as any[]) {
      const wid = r.worker_id;
      if (!byWorker[wid]) {
        byWorker[wid] = {
          name: r.workers?.name || 'Unknown',
          code: r.workers?.employee_code || '',
          totalHours: 0,
          overtimeHours: 0,
          present: 0,
          absent: 0,
          leave: 0,
          count: 0,
        };
      }
      byWorker[wid].totalHours += r.hours_worked || 0;
      byWorker[wid].overtimeHours += r.overtime_hours || 0;
      if (r.status === 'present') byWorker[wid].present++;
      else if (r.status === 'absent') byWorker[wid].absent++;
      else if (r.status === 'leave') byWorker[wid].leave++;
      byWorker[wid].count++;
    }
    return Object.entries(byWorker).map(([id, w]) => ({ id, ...w }));
  }, [reportData]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Attendance</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {currentFactoryId ? factories.find((f: any) => f.id === currentFactoryId)?.name || 'Selected' : 'All Factories'}
          </div>
        </div>
      </div>

      <Tabs defaultValue="entry">
        <TabsList className="mb-3">
          <TabsTrigger value="entry" className="text-xs"><ClipboardList className="h-3.5 w-3.5 mr-1" /> Entry</TabsTrigger>
          <TabsTrigger value="report" className="text-xs"><CalendarDays className="h-3.5 w-3.5 mr-1" /> Monthly Report</TabsTrigger>
        </TabsList>

        <TabsContent value="entry">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-[160px] text-xs" />
                </div>
                <div className="flex items-end gap-2 ml-auto">
                  <Button size="sm" variant="outline" onClick={markAllPresent} className="h-9 text-xs">
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Mark All Present
                  </Button>
                  <Button size="sm" onClick={() => saveAttendance.mutate()} disabled={saving} className="h-9 text-xs">
                    <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Saving...' : 'Save All'}
                  </Button>
                </div>
              </div>

              {factoryWorkers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p>No workers found for the selected factory.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Add workers in Settings → Worker Masters first.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-8">Code</TableHead>
                        <TableHead className="text-xs h-8">Name</TableHead>
                        <TableHead className="text-xs h-8">Type</TableHead>
                        <TableHead className="text-xs h-8">Shift</TableHead>
                        <TableHead className="text-xs h-8">Check In</TableHead>
                        <TableHead className="text-xs h-8">Check Out</TableHead>
                        <TableHead className="text-xs h-8 text-right">Hours</TableHead>
                        <TableHead className="text-xs h-8 text-right">OT</TableHead>
                        <TableHead className="text-xs h-8">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, i) => (
                        <TableRow key={row.workerId}>
                          <TableCell className="text-xs py-1.5 font-mono">{row.employeeCode}</TableCell>
                          <TableCell className="text-xs py-1.5">{row.workerName}</TableCell>
                          <TableCell className="text-xs py-1.5">{row.workerTypeName}</TableCell>
                          <TableCell className="py-1.5">
                            <Select value={row.shiftId} onValueChange={v => updateRow(i, 'shiftId', v)}>
                              <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {shiftsList.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input type="time" value={row.checkIn} onChange={e => updateRow(i, 'checkIn', e.target.value)} className="h-8 text-xs w-[90px]" />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input type="time" value={row.checkOut} onChange={e => updateRow(i, 'checkOut', e.target.value)} className="h-8 text-xs w-[90px]" />
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-medium">{row.hoursWorked || '—'}</TableCell>
                          <TableCell className="py-1.5">
                            <Input type="number" min={0} value={row.overtimeHours || ''} onChange={e => updateRow(i, 'overtimeHours', Number(e.target.value) || 0)} className="h-8 text-xs w-[60px] text-right" />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Select value={row.status} onValueChange={v => updateRow(i, 'status', v)}>
                              <SelectTrigger className={`h-8 text-xs w-[90px] ${row.status === 'absent' ? 'text-red-600' : row.status === 'leave' ? 'text-amber-600' : 'text-green-600'}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                                <SelectItem value="leave">Leave</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>{rows.length} worker{rows.length !== 1 ? 's' : ''}</span>
                    <span>
                      Present: <strong className="text-green-600">{rows.filter(r => r.status === 'present').length}</strong>
                      {' · '}Absent: <strong className="text-red-600">{rows.filter(r => r.status === 'absent').length}</strong>
                      {' · '}Leave: <strong className="text-amber-600">{rows.filter(r => r.status === 'leave').length}</strong>
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <Label className="text-xs">Month</Label>
                  <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="h-9 w-[180px] text-xs" />
                </div>
              </div>

              {monthlySummary.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p>No attendance data for {reportMonth}.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-8">Code</TableHead>
                        <TableHead className="text-xs h-8">Name</TableHead>
                        <TableHead className="text-xs h-8 text-right">Present</TableHead>
                        <TableHead className="text-xs h-8 text-right">Absent</TableHead>
                        <TableHead className="text-xs h-8 text-right">Leave</TableHead>
                        <TableHead className="text-xs h-8 text-right">Total Hours</TableHead>
                        <TableHead className="text-xs h-8 text-right">Overtime</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlySummary.map(w => (
                        <TableRow key={w.id}>
                          <TableCell className="text-xs py-1.5 font-mono">{w.code}</TableCell>
                          <TableCell className="text-xs py-1.5 font-medium">{w.name}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right text-green-600 font-medium">{w.present}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right text-red-600">{w.absent}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right text-amber-600">{w.leave}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-medium">{w.totalHours.toFixed(1)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right">{w.overtimeHours.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
