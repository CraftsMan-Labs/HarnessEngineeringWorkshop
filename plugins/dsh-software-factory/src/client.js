/* DSH web client factory bundle. CJS for window.__ModuleLoader__. */
(function (root) {
  var loader = root && root.__ModuleLoader__;
  function factory(require, module, exports) {
    var React = require('react');
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var PORT = 13081;
    var BASE = 'http://127.0.0.1:' + PORT;

    function fetchJson(path, opts) {
      return fetch(BASE + path, opts).then(function (res) {
        return res.json();
      });
    }

    function post(body) {
      return fetchJson('/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    function Field(props) {
      return h('input', {
        style: styles.input,
        placeholder: props.placeholder,
        value: props.value,
        onChange: function (e) { props.onChange(e.target.value); },
      });
    }

    function Board(props) {
      var snap = props.snap;
      var onAct = props.onAct;
      var epicTitle = useState('');
      var epicVision = useState('');
      var ticketTitle = useState('');
      var ticketBody = useState('');
      var epic = (snap.epics || []).find(function (e) { return e.id === snap.currentEpicId; }) || (snap.epics || [])[0];
      var ticket = (snap.tickets || []).find(function (t) { return t.id === snap.currentTicketId; });
      var next = snap.nextStates || [];

      return h(Section, { title: '0. Epics and tickets' },
        h('p', { style: styles.muted }, 'CRUD + select + move state'),
        (snap.epics || []).map(function (item) {
          return h('button', {
            key: item.id,
            style: item.id === (epic && epic.id) ? styles.active : styles.btn,
            onClick: function () { onAct({ type: 'epic', action: 'select', epicId: item.id }); },
          }, item.title);
        }),
        h('div', null,
          h(Field, { placeholder: 'epic title', value: epicTitle[0], onChange: epicTitle[1] }),
          h(Field, { placeholder: 'vision', value: epicVision[0], onChange: epicVision[1] }),
          h('button', {
            style: styles.btn,
            onClick: function () {
              if (!epicTitle[0] || !epicVision[0]) return;
              onAct({ type: 'epic', action: 'create', title: epicTitle[0], vision: epicVision[0] });
              epicTitle[1]('');
              epicVision[1]('');
            },
          }, 'Create epic'),
          epic
            ? h('button', {
                style: styles.btn,
                onClick: function () {
                  onAct({
                    type: 'epic',
                    action: 'update',
                    epicId: epic.id,
                    title: epicTitle[0] || epic.title,
                    vision: epicVision[0] || epic.vision,
                  });
                },
              }, 'Save epic')
            : null,
          epic
            ? h('button', {
                style: styles.btn,
                onClick: function () { onAct({ type: 'epic', action: 'delete', epicId: epic.id }); },
              }, 'Delete epic')
            : null,
        ),
        h('p', { style: styles.muted }, 'tickets'),
        (snap.tickets || []).filter(function (t) { return !epic || t.epicId === epic.id; }).map(function (item) {
          return h('button', {
            key: item.id,
            style: item.id === (ticket && ticket.id) ? styles.active : styles.btn,
            onClick: function () { onAct({ type: 'ticket', action: 'select', ticketId: item.id }); },
          }, item.title + ' · ' + item.state);
        }),
        epic
          ? h('div', null,
              h(Field, { placeholder: 'ticket title', value: ticketTitle[0], onChange: ticketTitle[1] }),
              h(Field, { placeholder: 'ticket body', value: ticketBody[0], onChange: ticketBody[1] }),
              h('button', {
                style: styles.btn,
                onClick: function () {
                  onAct({
                    type: 'ticket',
                    action: 'create',
                    epicId: epic.id,
                    title: ticketTitle[0] || epic.title,
                    body: ticketBody[0] || epic.vision,
                  });
                  ticketTitle[1]('');
                  ticketBody[1]('');
                },
              }, 'Create ticket'),
              ticket
                ? h('button', {
                    style: styles.btn,
                    onClick: function () {
                      onAct({
                        type: 'ticket',
                        action: 'update',
                        ticketId: ticket.id,
                        title: ticketTitle[0] || ticket.title,
                        body: ticketBody[0] || ticket.body,
                      });
                    },
                  }, 'Save ticket')
                : null,
              ticket
                ? h('button', {
                    style: styles.btn,
                    onClick: function () { onAct({ type: 'ticket', action: 'delete', ticketId: ticket.id }); },
                  }, 'Delete ticket')
                : null,
            )
          : h('p', { style: styles.muted }, 'create an epic first'),
        ticket
          ? h('div', null,
              next.map(function (state) {
                return h('button', {
                  key: state,
                  style: styles.btn,
                  onClick: function () {
                    if (state === 'approved') onAct({ type: 'ticket', action: 'approve', ticketId: ticket.id, epicId: epic && epic.id });
                    else if (state === 'implementing' && ticket.state === 'approved') onAct({ type: 'ticket', action: 'implement', ticketId: ticket.id });
                    else onAct({ type: 'ticket', action: 'transition', ticketId: ticket.id, state: state });
                  },
                }, ticket.state + ' → ' + state);
              }),
            )
          : null,
      );
    }

    function Panel(props) {
      var snap = props.snap;
      var onAct = props.onAct;
      var err = props.err;
      var ticket = (snap.tickets || []).find(function (t) {
        return t.id === snap.currentTicketId;
      }) || (snap.tickets || [])[0];
      var epic = (snap.epics || []).find(function (e) {
        return e.id === snap.currentEpicId;
      }) || (ticket
        ? (snap.epics || []).find(function (e) {
            return e.id === ticket.epicId;
          })
        : (snap.epics || [])[0]);
      var q = snap.pendingQuestion;
      var incidents = snap.incidents || [];

      return h(
        'div',
        { style: styles.overlay, onClick: props.onClose },
        h(
          'div',
          { style: styles.panel, onClick: function (e) { e.stopPropagation(); } },
          h('header', { style: styles.header },
            h('strong', null, 'Software Factory'),
            h('button', { style: styles.btn, onClick: props.onClose }, 'Close'),
          ),
          err ? h('p', { style: styles.err }, String(err)) : null,
          h(Board, { snap: snap, onAct: onAct }),
          h(Section, { title: '1. Phase' },
            h('p', null, 'state: ', h('code', null, snap.phase || 'idle')),
            ticket ? h('p', null, 'ticket: ', ticket.title, ' (', ticket.id, ')') : h('p', null, 'no ticket'),
            epic ? h('p', null, 'epic: ', epic.title) : null,
            ticket && ticket.state === 'aligning'
              ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'ticket', action: 'approve', ticketId: ticket.id, epicId: epic && epic.id }); } }, 'Approve alignment')
              : null,
            ticket && ticket.state === 'approved'
              ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'ticket', action: 'implement', ticketId: ticket.id }); } }, 'Start implementation')
              : null,
            ticket && (ticket.state === 'validating' || ticket.state === 'pr_ready')
              ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'ticket', action: 'transition', ticketId: ticket.id, state: 'implementing' }); } }, 'Reject → implement')
              : null,
            ticket && ticket.state === 'validating'
              ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'ticket', action: 'transition', ticketId: ticket.id, state: 'pr_ready' }); } }, 'Mark PR ready')
              : null,
            ticket && ticket.state === 'pr_ready'
              ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'ticket', action: 'transition', ticketId: ticket.id, state: 'done' }); } }, 'Mark done')
              : null,
          ),
          h(Section, { title: '2. Timeline' },
            h('pre', { style: styles.pre },
              ((epic && epic.history) || []).concat((ticket && ticket.history) || []).slice(-12).map(row).join('\n') || 'empty',
            ),
            h('p', { style: styles.muted }, 'artifacts: ', snap.artifacts && snap.artifacts.root),
          ),
          h(Section, { title: '3. Pending human question' },
            q
              ? h('div', null,
                  h('p', null, q.prompt),
                  h('p', { style: styles.muted }, 'recommended: ', q.recommended),
                  h('button', { style: styles.btn, onClick: function () { onAct({ type: 'align', action: 'answer', epicId: epic && epic.id, questionId: q.id, answer: q.recommended }); } }, 'Accept recommended'),
                )
              : h('p', { style: styles.muted }, 'none'),
          ),
          h(Section, { title: '4. Quality gates' },
            h('pre', { style: styles.pre },
              ((ticket && ticket.evidence) || []).map(function (e) {
                return e.at + '  ' + e.command + '  exit=' + e.exitCode;
              }).join('\n') || 'no evidence',
            ),
            ticket
              ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'evidence', action: 'run', ticketId: ticket.id }); } }, 'Rerun gates')
              : null,
            ticket && ticket.review
              ? h('p', null, 'review: ', ticket.review.verdict, ' by ', ticket.review.reviewer)
              : ticket
                ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'ticket', action: 'review', ticketId: ticket.id, reviewer: 'human', verdict: 'approved' }); } }, 'Approve review')
                : null,
          ),
          h(Section, { title: '5. Incident / Three Whys' },
            incidents.length
              ? incidents.map(function (inc) {
                  return h('div', { key: inc.id },
                    h('p', null, inc.title, ' · ', inc.classification, ' · ', inc.status),
                    h('pre', { style: styles.pre }, (inc.whys || []).map(function (w, i) { return (i + 1) + '. ' + w; }).join('\n')),
                    inc.status === 'open'
                      ? h('button', { style: styles.btn, onClick: function () { onAct({ type: 'learn', action: 'close', incidentId: inc.id, knowledge: 'recorded from dashboard' }); } }, 'Close incident')
                      : null,
                  );
                })
              : h('p', { style: styles.muted }, 'no incidents — open from chat with factory_learn'),
          ),
        ),
      );
    }

    function Section(props) {
      return h('section', { style: styles.section }, h('h3', { style: styles.h3 }, props.title), props.children);
    }

    function row(item) {
      return (item.at || '') + '  ' + (item.action || '') + (item.to ? ' → ' + item.to : '');
    }

    function FactoryButton() {
      var open = useState(false);
      var snap = useState(null);
      var err = useState('');
      var setOpen = open[1];
      var setSnap = snap[1];
      var setErr = err[1];

      function refresh() {
        return fetchJson('/snapshot').then(function (data) {
          setSnap(data);
          setErr('');
        }).catch(function (e) {
          setErr(e.message || String(e));
        });
      }

      useEffect(function () {
        if (!open[0]) return undefined;
        refresh();
        var timer = setInterval(refresh, 2000);
        return function () { clearInterval(timer); };
      }, [open[0]]);

      function onAct(body) {
        return post(body).then(function (res) {
          if (res && res.ok === false) setErr(res.error);
          return refresh();
        }).catch(function (e) {
          setErr(e.message || String(e));
        });
      }

      return h('div', null,
        h('button', { style: styles.launch, onClick: function () { setOpen(true); } }, 'Factory'),
        open[0] ? h(Panel, { snap: snap[0] || { phase: 'loading' }, err: err[0], onAct: onAct, onClose: function () { setOpen(false); } }) : null,
      );
    }

    function apply(ctx) {
      if (!ctx || !ctx.slots || !ctx.slots.inject) return;
      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'software-factory',
          order: 80,
          label: 'Factory',
        }, FactoryButton);
      });
    }

    var exported = { name: 'dsh-software-factory', inject: ['slots'], apply: apply };
    if (module) module.exports = exported;
    if (exports) {
      exports.name = exported.name;
      exports.inject = exported.inject;
      exports.apply = exported.apply;
    }
    return exported;
  }

  if (loader && typeof loader.load === 'function') {
    loader.load({ id: 'dsh-software-factory', factory: factory });
  } else if (typeof module !== 'undefined') {
    module.exports = factory(function () { return require('react'); }, module, module.exports);
  }

  var styles = {
    launch: { padding: '6px 10px', cursor: 'pointer' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' },
    panel: { width: 420, maxWidth: '100%', height: '100%', overflow: 'auto', background: '#111', color: '#eee', padding: 16, font: '13px/1.4 ui-sans-serif, system-ui' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    section: { margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid #333' },
    h3: { margin: '0 0 8px', fontSize: 13 },
    pre: { whiteSpace: 'pre-wrap', background: '#1b1b1b', padding: 8, borderRadius: 4 },
    btn: { marginRight: 8, marginTop: 6, padding: '4px 8px', cursor: 'pointer' },
    active: { marginRight: 8, marginTop: 6, padding: '4px 8px', cursor: 'pointer', background: '#333', color: '#fff' },
    input: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '4px 6px', background: '#1b1b1b', color: '#eee', border: '1px solid #333' },
    muted: { color: '#aaa' },
    err: { color: '#f88' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
