// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
const { peopleScope, assertPerson, assertDepartment, canAssignRole, redactPeople } = require('./people-access');

function getPython() {
  for (const cmd of ['python3', 'python']) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' });
      return cmd;
    } catch {}
  }
  return 'python';
}

const pyScript = `import json, sqlite3, sys
payload = json.load(sys.stdin)
db = sqlite3.connect(':memory:')
db.execute("ATTACH DATABASE ':memory:' AS public")
db.executescript('''
CREATE TABLE public.employee (empno TEXT PRIMARY KEY, is_deleted BOOLEAN);
CREATE TABLE public.app_user (empno TEXT UNIQUE, role TEXT);
CREATE TABLE public.jobhistory (empno TEXT, deptcode TEXT, jobcode TEXT, effdate TEXT, is_deleted BOOLEAN);
''')
for person in payload['people']:
    db.execute('INSERT INTO public.employee VALUES (?, ?)', (person['empno'], person.get('archived', False)))
    if person.get('role'):
        db.execute('INSERT INTO public.app_user VALUES (?, ?)', (person['empno'], person['role']))
    if person.get('dept'):
        db.execute('INSERT INTO public.jobhistory VALUES (?, ?, ?, ?, ?)',
                   (person['empno'], person['dept'], 'JOB', '2020-01-01', person.get('archived', False)))
    if person.get('future'):
        db.execute('INSERT INTO public.jobhistory VALUES (?, ?, ?, ?, ?)',
                   (person['empno'], person['future'], 'JOB', '2999-01-01', False))
json.dump([[row[0] for row in db.execute(statement)] for statement in payload['statements']], sys.stdout)
`;

const people = [
  ['s1', 'employee', 'BR1'], ['s2', 'employee', 'BR2'],
  ['sm1', 'admin', 'BR1'], ['sm2', 'admin', 'BR2'],
  ['a1', 'employee', 'ACT'], ['am', 'admin', 'ACT'],
  ['hr', 'employee', 'HRD'], ['hm', 'admin', 'HRD'], ['hm2', 'admin', 'HRD'],
  ['it', 'it_admin', 'IT'], ['sa', 'superadmin', 'EXC'],
  ['none', 'employee', null], ['nomgr', 'admin', null], ['noacct', null, 'BR1'],
  ['arch', 'employee', 'BR1'], ['future', 'employee', 'BR1'],
].map(([empno, role, dept]) => ({ empno, role, dept, archived: empno === 'arch', future: empno === 'future' ? 'HRD' : null }));

test('SQL visibility matrix filters people before pagination and counts, including archive/future/unassigned cases', () => {
  const cases = [
    ['s1', false, ['s1', 'sm1', 'noacct', 'arch', 'future']],
    ['s2', false, ['s2', 'sm2']],
    ['sm1', false, ['s1', 's2', 'sm1', 'noacct', 'arch', 'future']],
    ['sm2', false, ['s1', 's2', 'sm2', 'noacct', 'arch', 'future']],
    ['am', false, ['a1', 'am']],
    ['hr', false, ['s1', 's2', 'a1', 'hr', 'hm', 'hm2', 'none', 'noacct', 'arch', 'future']],
    ['hm', false, people.filter(p => p.empno !== 'sa').map(p => p.empno)],
    ['it', true, people.filter(p => p.empno !== 'sa').map(p => p.empno)],
    ['it', false, ['it']], ['sa', false, people.map(p => p.empno)],
    ['none', false, ['none']], ['nomgr', false, ['nomgr']],
    ['future', false, ['s1', 'sm1', 'noacct', 'arch', 'future']],
  ];
  const statements = cases.map(([id, accounts]) => {
    const user = { ...people.find(p => p.empno === id), rights: ['hr.employee.edit', 'hr.department.delete'], jobTitle: 'HR Manager' };
    return `SELECT e.empno FROM public.employee e WHERE ${peopleScope(user, 'e.empno', accounts)} ORDER BY e.empno`;
  });
  statements.push(`SELECT count(*) FROM public.employee e WHERE ${peopleScope(people[2], 'e.empno')} AND e.empno = 'am'`);
  statements.push(`${statements[2]} LIMIT 2 OFFSET 2`);
  const result = JSON.parse(execFileSync(getPython(), ['-c', pyScript], { input: JSON.stringify({ people, statements }), encoding: 'utf8' }));
  cases.forEach(([, , expected], i) => expect(result[i], cases[i][0]).toEqual([...expected].sort()));
  expect(result.at(-2)).toEqual([0]);
  expect(result.at(-1)).toEqual(['noacct', 's1']);
});

test.each(['employee', 'admin', 'it_admin', 'superadmin'])('%s role grants are explicit', role => {
  const allowed = ['employee', 'admin', 'it_admin', 'superadmin'].filter(target => canAssignRole({ role }, target));
  expect(allowed).toEqual(role === 'superadmin' ? ['employee', 'admin', 'it_admin', 'superadmin'] : role === 'it_admin' ? ['employee', 'admin'] : ['employee']);
});

test.each(['employee', 'user'])('stamps are absent for %s even with editing rights', role => {
  const body = { employee: { stamp: 'private', salary: 10 }, history: [{ stamp: 'private' }], jobs: [{ stamp: 'private' }] };
  const result = redactPeople(body, { role, rights: ['hr.employee.edit', 'hr.history.delete'] });
  expect(JSON.stringify(result)).not.toContain('stamp');
  expect(result.employee.salary).toBe(10);
  expect(body.employee.stamp).toBe('private');
});

test('IT Admin custom permissions never reveal salary', () => {
  expect(redactPeople({ salary: 100 }, { role: 'it_admin', rights: ['hr.salary', 'hr.employee.edit'] })).toEqual({ salary: null });
});

test.each(['admin', 'it_admin', 'superadmin'])('HR admin cannot mutate %s records', async role => {
  const db = { query: vi.fn().mockResolvedValue({ rows: [{ empno: 'target', role, department: 'HRD' }] }) };
  await expect(assertPerson(db, { empno: 'hm', role: 'admin' }, 'target', { write: true })).rejects.toMatchObject({ statusCode: 404 });
});

test('IT cannot mutate its own role or other IT/Superadmin records', async () => {
  for (const role of ['it_admin', 'superadmin']) {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ empno: 'it', role }] }) };
    await expect(assertPerson(db, { empno: 'it', role: 'it_admin' }, 'it', { accounts: true, write: true })).rejects.toMatchObject({ statusCode: 404 });
  }
});

test('self transfers, unassigned transfers and out-of-scope reassignments are refused', async () => {
  const db = { query: vi.fn().mockResolvedValue({ rows: [{ department: 'BR1' }] }) };
  await expect(assertDepartment(db, { empno: 's1', role: 'employee' }, 'HRD', 's1', 'BR1')).rejects.toMatchObject({ statusCode: 404 });
  await expect(assertDepartment(db, { empno: 'sm1', role: 'admin' }, 'HRD', 's1', 'BR1')).rejects.toMatchObject({ statusCode: 404 });
  await expect(assertDepartment(db, { empno: 'sm1', role: 'admin' }, 'BR2', 's1', 'BR1')).resolves.toBeUndefined();
  db.query.mockResolvedValue({ rows: [{ department: null }] });
  await expect(assertDepartment(db, { empno: 'none', role: 'employee' }, 'HRD')).rejects.toMatchObject({ statusCode: 404 });
});
