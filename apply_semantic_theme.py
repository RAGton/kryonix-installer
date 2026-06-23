import os
import glob

replacements = {
    'bg-[#1C1C1E]': 'bg-apple-panel',
    'bg-[#2C2C2E]': 'bg-apple-panelHover',
    'bg-[#3A3A3C]': 'bg-apple-inputDisabled',
    
    'border-[#38383A]': 'border-apple-border',
    'border-[#E5E5EA]': 'border-apple-border',
    
    'text-[#F5F5F7]': 'text-apple-textPrimary',
    'text-[#86868B]': 'text-apple-textSecondary',
    'text-[#A1A1A6]': 'text-apple-textSecondary',
    'text-[#1D1D1F]': 'text-apple-textPrimary',
    'text-[#515154]': 'text-apple-textSecondary',
    
    'bg-[#0071E3]': 'bg-apple-blue',
    'bg-[#0A84FF]': 'bg-apple-blue',
    'bg-[#0A84FF]/10': 'bg-apple-blueTransparent',
    'bg-[#0A84FF]/15': 'bg-apple-blueTransparent',
    'bg-[#5E5CE6]/15': 'bg-apple-blueTransparent',
    
    'text-[#0A84FF]': 'text-apple-blue',
    'text-[#0A84FF]/80': 'text-apple-blue',
    
    'border-[#0A84FF]/30': 'border-apple-blue',
    'border-[#5E5CE6]/60': 'border-apple-blue',
    
    'bg-[#32D74B]/10': 'bg-apple-success/10',
    'text-[#32D74B]': 'text-apple-success',
    'border-[#32D74B]/30': 'border-apple-success',
    
    'bg-[#FF9F0A]/10': 'bg-apple-warning/10',
    'text-[#FF9F0A]': 'text-apple-warning',
    'text-[#FF9F0A]/80': 'text-apple-warning',
    'border-[#FF9F0A]/30': 'border-apple-warning',
    'ring-[#FF9F0A]/50': 'ring-apple-warning/50',
    
    'bg-[#FF453A]/10': 'bg-apple-danger/10',
    'text-[#FF453A]': 'text-apple-danger',
    'text-[#FF453A]/70': 'text-apple-danger',
    'border-[#FF453A]/30': 'border-apple-danger',
}

files = glob.glob('ui/src/pages/*.jsx') + glob.glob('ui/src/components/*.jsx') + glob.glob('ui/src/*.jsx')

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    changed = False
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
            changed = True
        
    if changed:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")
