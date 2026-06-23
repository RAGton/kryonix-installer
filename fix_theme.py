import os

replacements = {
    'bg-white': 'bg-[#1C1C1E]',
    'bg-[#F5F5F7]': 'bg-[#2C2C2E]',
    'border-[#E5E5EA]': 'border-[#38383A]',
    'text-[#1D1D1F]': 'text-[#F5F5F7]',
    'text-[#515154]': 'text-[#A1A1A6]',
    'text-[#A1A1A6]': 'text-[#6E6E73]',
    'bg-[#0071E3]': 'bg-[#0A84FF]',
    'text-[#0071E3]': 'text-[#0A84FF]',
    'border-[#0071E3]': 'border-[#0A84FF]',
    'ring-[#0071E3]': 'ring-[#0A84FF]',
    'bg-[#34C759]': 'bg-[#32D74B]',
    'text-[#34C759]': 'text-[#32D74B]',
    'border-[#34C759]': 'border-[#32D74B]',
    'bg-[#FF3B30]': 'bg-[#FF453A]',
    'text-[#FF3B30]': 'text-[#FF453A]',
    'border-[#FF3B30]': 'border-[#FF453A]',
    'bg-[#FF9500]': 'bg-[#FF9F0A]',
    'text-[#FF9500]': 'text-[#FF9F0A]',
    'border-[#FF9500]': 'border-[#FF9F0A]',
    'hover:bg-[#F5F5F7]': 'hover:bg-[#3A3A3C]',
    'hover:bg-white': 'hover:bg-[#3A3A3C]',
    'hover:border-[#D1D1D6]': 'hover:border-[#515154]',
    'bg-[#E5E5EA]': 'bg-[#3A3A3C]',
    'border-[#C7C7CC]': 'border-[#515154]',
    'shadow-[0_4px_24px_rgba(0,0,0,0.04)]': 'shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
    'shadow-[0_2px_12px_rgba(0,0,0,0.02)]': 'shadow-[0_2px_12px_rgba(0,0,0,0.2)]',
    'shadow-[0_2px_8px_rgba(0,0,0,0.08)]': 'shadow-[0_2px_8px_rgba(0,0,0,0.4)]',
}

files = [
    'ui/src/pages/Disks.jsx',
    'ui/src/pages/Users.jsx',
    'ui/src/pages/Install.jsx',
    'ui/src/pages/Summary.jsx'
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(filepath, 'w') as f:
        f.write(content)
    
print("Updated files.")
