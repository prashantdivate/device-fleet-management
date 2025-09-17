import React from 'react'

export function Icon({ name, size = 18 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round'
  }
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="6.5" height="6.5" rx="1"></rect>
          <rect x="14.5" y="3" width="6.5" height="6.5" rx="1"></rect>
          <rect x="3" y="14.5" width="6.5" height="6.5" rx="1"></rect>
          <rect x="14.5" y="14.5" width="6.5" height="6.5" rx="1"></rect>
        </svg>
      )
    case 'wrench':
      return (
        <svg {...common}>
          <path d="M21 3l-6.5 6.5M13 3a5 5 0 00-5 5 5 5 0 005 5c1.4 0 2.7-.52 3.7-1.38L20 20l-2 2-4.3-4.3A6.97 6.97 0 0113 18a7 7 0 110-14z"/>
        </svg>
      )
    case 'location':
      return (
        <svg {...common}>
          <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/>
          <circle cx="12" cy="10" r="2.6"/>
        </svg>
      )
    case 'ellipsis':
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.6"/>
          <circle cx="12" cy="12" r="1.6"/>
          <circle cx="18" cy="12" r="1.6"/>
        </svg>
      )
    case 'diagnostics':
      return (
        <svg {...common}>
          <path d="M20 8.5c0-3-2.4-5.5-5.4-5.5-1.6 0-3 .7-4 1.9A5 5 0 005.6 3 5.6 5.6 0 000 8.5c0 5 7.7 9.7 12 12 4.3-2.3 12-7 12-12z" transform="translate(0 0)" stroke="none" fill="currentColor" opacity="0.15"/>
          <polyline points="4 13 8 13 10 8 13 16 15 12 20 12" />
        </svg>
      )
    case 'power':
      return (
        <svg {...common}><path d="M12 2v7"/><path d="M5.5 7.5a7 7 0 1 0 13 0"/></svg>
      )
    case 'restart':
      return (
        <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/></svg>
      )
    case 'chevron-down':
      return (
        <svg {...common}><polyline points="6 9 12 15 18 9"/></svg>
      )
    case 'chevron-up':
      return (
        <svg {...common}><polyline points="18 15 12 9 6 15"/></svg>
      )
    case 'question':
      return (
        <svg {...common}><path d="M9 9a3 3 0 1 1 3 3v2"/><line x1="12" y1="19" x2="12" y2="19"/></svg>
      )
    case 'copy':
      return (
        <svg {...common}><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="3" y="3" width="13" height="13" rx="2"/></svg>
      )
    case 'play':
      return (<svg {...common}><polygon points="8 5 19 12 8 19 8 5"/></svg>)
    case 'file':
      return (<svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>)
    case 'search':
      return (<svg {...common}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>)
    case 'pause':
      return (<svg {...common}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>)
    case 'download':
      return (<svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>)
    case 'options':
      return (<svg {...common}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>)
    default:
      return null
  }
}