import type { GameProgress } from '@/types'

export interface CorporateEmail {
  id: string
  from: string
  role: string
  date: string
  subject: string
  body: string[]
  voiceClip?: {
    file: string
    label: string
    duration: string
    transcript: string
  }
  unlockWhen?: (progress: GameProgress) => boolean
}

export interface ChatMessage {
  id: string
  sender: string
  handle: string
  time: string
  isSystem?: boolean
  isAnomaly?: boolean
  text: string
  visibleWhen?: (progress: GameProgress) => boolean
}

export const CORPORATE_EMAILS: readonly CorporateEmail[] = [
  {
    id: 'ops-closing',
    from: 'Operaciones · Cierre Anual',
    role: 'ops-cron@planta04.local',
    date: '24/12/2026 · 23:45',
    subject: '[AUTOMÁTICO] Ejecución de cierre fiscal 00:00',
    body: [
      'A las 00:00 se ejecutará la purga anual de puestos sin registro de salida válido en el mismo día natural.',
      'AVISO CONOCIDO (#BUG-1224): las guardias iniciadas el 24/12 cuya salida ocurre el 25/12 tras medianoche pueden ser marcadas como «puesto vacío» por el validador de fechas.',
      'Si permaneces en Planta 04 durante la guardia de Nochebuena, verifica los folios físicos en recepción (árbol y bitácora) y confirma la restauración en la consola A-06 antes de abandonar el edificio.'
    ]
  },
  {
    id: 'salas-2023',
    from: 'I. Salas',
    role: 'i.salas@planta04.local · A-07',
    date: '25/12/2023 · 00:11',
    subject: 'RE: Mi puesto no aparece en el inventario',
    body: [
      'Acabo de cerrar la guardia del 24/12/2023. Entré a las 21:00 y salí diez minutos después de medianoche.',
      'El script de cierre me marcó como ausente porque leyó 00:10 en el mismo día 24. Dejé la etiqueta del folio 07 colgada en el árbol de recepción y firmé la bitácora para que quede constancia física.',
      'Te adjunto una nota de voz rápida antes de que se corte el fluorescente de mi escritorio.'
    ],
    voiceClip: {
      file: 'voicemail-salas.mp3',
      label: 'nota-voz-salas-a07.mp3',
      duration: '0:09',
      transcript:
        '«Soy Salas, guardia del A-07. Son las doce y diez del veinticinco. El cierre acaba de borrar mi turno… no dejes que cierre sin restaurarnos.»'
    }
  },
  {
    id: 'rojas-2025',
    from: 'M. Rojas',
    role: 'm.rojas@planta04.local · B-02',
    date: '25/12/2025 · 00:21',
    subject: 'No dejes el cierre en --force',
    body: [
      'Si estás leyendo esto en la guardia del 2026, el parche de fechas tampoco se desplegó este año.',
      'Mi turno de 2025 (folio 19, puesto B-02) terminó a las 00:20 del día 25. El árbol en recepción guarda el orden de los adornos; solo se iluminan cuando el sistema vuelve a reconocer el puesto anterior.',
      'Escucha el audio adjunto y comprueba bien los minutos en la bitácora antes de confirmar.'
    ],
    voiceClip: {
      file: 'voicemail-rojas.mp3',
      label: 'nota-voz-rojas-b02.mp3',
      duration: '0:10',
      transcript:
        '«Aquí Rojas, puesto B-02. Dejé la hora en la bitácora y el folio diecinueve en el árbol. Si el sistema no te ve después de medianoche… tampoco estás.»'
    }
  },
  {
    id: 'purge-alert',
    from: 'Sistema de Inventario',
    role: 'daemon@planta04.local',
    date: '24/12/2026 · 23:54',
    subject: '[ALERTA] Puesto A-07 purgado del plano físico',
    body: [
      'REGISTRO ACTUALIZADO: El puesto A-07 figuraba sin turno válido tras el cambio de fecha.',
      'Se ha revocado su asignación eléctrica, mobiliario e historial de presencia. El rastro residual permanecerá hasta que el folio 07 sea restaurado con su fecha real de salida.',
      'Siguiente puesto en cola de revisión: A-06 (turno activo).'
    ],
    unlockWhen: progress => progress.a07Disappeared
  }
]

export const CORPORATE_CHAT: readonly ChatMessage[] = [
  {
    id: 'bot-start',
    sender: 'cierre-bot',
    handle: 'BOT · PLANTA 04',
    time: '23:52',
    isSystem: true,
    text: 'Cierre anual iniciado. Escaneando puestos ocupados en Planta 04…'
  },
  {
    id: 'bot-a07-warn',
    sender: 'cierre-bot',
    handle: 'BOT · PLANTA 04',
    time: '23:52',
    isSystem: true,
    text: 'Inconsistencia en folio 07 (A-07): hora de salida 00:10 < hora de entrada 21:00. Marcando puesto como vacío.'
  },
  {
    id: 'ghost-a07-vanished',
    sender: 'I. Salas (A-07)',
    handle: 'desconectado · 2023',
    time: '23:54',
    isAnomaly: true,
    text: 'Acaba de apagarse mi lámpara. ¿Sigues viendo la taza en la mesa?',
    visibleWhen: progress => progress.a07Disappeared
  },
  {
    id: 'bot-a07-restored',
    sender: 'cierre-bot',
    handle: 'BOT · PLANTA 04',
    time: '23:57',
    isSystem: true,
    text: '✓ Folio 07 restaurado (25/12/2023 00:10). Puesto A-07 reasignado en el plano. Señal detectada en adorno 19.'
  },
  {
    id: 'ghost-b02',
    sender: 'M. Rojas (B-02)',
    handle: 'desconectado · 2025',
    time: '23:57',
    isAnomaly: true,
    text: 'Ahora puedes ver mi folio en el árbol. No confundas 00:02 con 00:20 en la bitácora.',
    visibleWhen: progress => progress.restored['folio-07']
  },
  {
    id: 'bot-b02-restored',
    sender: 'cierre-bot',
    handle: 'BOT · PLANTA 04',
    time: '23:59',
    isSystem: true,
    text: '✓ Folio 19 restaurado. Puesto B-02 visible en recepción. Última verificación pendiente: puesto A-06.',
    visibleWhen: progress => progress.restored['folio-19']
  },
  {
    id: 'bot-ready',
    sender: 'cierre-bot',
    handle: 'BOT · PLANTA 04',
    time: '00:00',
    isSystem: true,
    text: '✓ Commit confirmado. Tres guardias conservadas. Pestillo de salida liberado.',
    visibleWhen: progress => progress.commitConfirmed
  }
]

export function executeTerminalCommand(
  rawInput: string,
  progress: GameProgress
): { lines: string[]; triggerForceEnding?: boolean } {
  const cmd = rawInput.trim().toLowerCase()

  if (!cmd || cmd === 'help' || cmd === 'ayuda') {
    return {
      lines: [
        'Comandos disponibles en planta-04@a06:',
        '  git status        — Estado de los folios de cierre',
        '  git log           — Historial de guardias de Nochebuena',
        '  tail cierre.log   — Registro en vivo del demonio de cierre',
        '  whoami            — Comprobar tu sesión activa',
        '  git commit --force — [PELIGRO] Forzar cierre sin restaurar turnos'
      ]
    }
  }

  if (cmd === 'whoami') {
    return {
      lines: [
        progress.restored['folio-26']
          ? 'guardia@planta04 (A-06 · Folio 26 · PRESENCIA VERIFICADA)'
          : 'guardia@planta04 (A-06 · Folio 26 · PENDIENTE DE PURGA A LAS 00:00)'
      ]
    }
  }

  if (cmd === 'git status') {
    return {
      lines: [
        'En la rama cierre-anual/2026',
        `  folio-07 (A-07 · I. Salas):   ${progress.restored['folio-07'] ? 'restaurado ✓' : progress.a07Disappeared ? 'ELIMINADO DEL PLANO' : 'en revisión'}`,
        `  folio-19 (B-02 · M. Rojas):   ${progress.restored['folio-19'] ? 'restaurado ✓' : 'ausente en inventario'}`,
        `  folio-26 (A-06 · Turno act.): ${progress.restored['folio-26'] ? 'restaurado ✓' : 'en riesgo de cierre'}`,
        progress.commitConfirmed
          ? 'Estado: commit confirmado. Puerta de salida desbloqueada.'
          : 'Usa la app «Cierre anual» para validar las evidencias físicas.'
      ]
    }
  }

  if (cmd === 'git log') {
    return {
      lines: [
        `commit 26f0015 (HEAD -> cierre-2026) ${progress.restored['folio-26'] ? '[RESTAURADO]' : '[SIN CONFIRMAR]'}`,
        'Author: Turno actual <a06@planta04.local>',
        'Date:   24/12/2026 22:30 -> 25/12/2026 00:15',
        '',
        `commit 19b0020 ${progress.restored['folio-19'] ? '[RESTAURADO]' : '[MARCADO VACÍO]'}`,
        'Author: M. Rojas <b02@planta04.local>',
        'Date:   24/12/2025 22:00 -> 25/12/2025 00:20',
        '',
        `commit 07a0010 ${progress.restored['folio-07'] ? '[RESTAURADO]' : '[PURGADO]'}`,
        'Author: I. Salas <a07@planta04.local>',
        'Date:   24/12/2023 21:00 -> 25/12/2023 00:10'
      ]
    }
  }

  if (cmd === 'tail cierre.log' || cmd === 'cat cierre.log') {
    const out = [
      '[23:52:01] daemon: inicio de auditoría de puestos Planta 04',
      '[23:52:04] WARN: validador de fechas rechazó salida < entrada en folio 07'
    ]

    if (progress.a07Disappeared) {
      out.push(
        '[23:54:12] PURGE: puesto A-07 retirado del espacio físico (sin testigos en sala)'
      )
    }

    if (progress.restored['folio-07']) {
      out.push('[23:57:03] RESTORE: folio 07 validado -> A-07 restaurado')
    }

    if (progress.restored['folio-19']) {
      out.push('[23:59:10] RESTORE: folio 19 validado -> B-02 restaurado')
    }

    if (progress.commitConfirmed) {
      out.push(
        '[00:00:00] COMMIT OK: cerradura electromagnética de salida liberada'
      )
    }

    return { lines: out }
  }

  if (
    cmd === 'git commit --force' ||
    cmd === 'git push --force' ||
    cmd === 'git commit --allow-empty --force'
  ) {
    if (progress.commitConfirmed) {
      return {
        lines: [
          'El cierre ya fue confirmado de forma limpia. No hace falta forzarlo.'
        ]
      }
    }

    return {
      lines: [
        'ADVERTENCIA: forzando cierre anual con registros ausentes…',
        'Purgando puestos no verificados (A-07, B-02, A-06)…'
      ],
      triggerForceEnding: true
    }
  }

  return {
    lines: [
      `bash: ${rawInput.trim()}: orden no reconocida. Escribe «help» para ver los comandos.`
    ]
  }
}
