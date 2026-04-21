export default function BottomNav({ active, onChange }) {
  const tabs = [
    { id: 'home',     icon: '◈', label: 'Home'     },
    { id: 'floor',    icon: '◎', label: 'Floor'    },
    { id: 'projects', icon: '◆', label: 'Projects' },
    { id: 'data',     icon: '▲', label: 'Data'     },
    { id: 'reports',  icon: '◉', label: 'Reports'  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-40"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
        >
          {active === t.id && (
            <span className="absolute top-0 left-4 right-4 h-0.5 rounded-full bg-[#E8820C]" />
          )}
          <span className={`text-base leading-none ${active === t.id ? 'text-[#E8820C]' : 'text-gray-400'}`}>
            {t.icon}
          </span>
          <span className={`text-[10px] font-medium ${active === t.id ? 'text-[#E8820C]' : 'text-gray-400'}`}>
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
