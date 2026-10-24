# Contrast of division tile labels on the surface they sit on. Values copied from booker/app/globals.css on 2026-10-23.
# Run: python3 .plans/previews/booker-mobile-spacing-colours/contrast.py
def hx(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def lum(c):
    def ch(v):
        v/=255; return v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    r,g,b=c; return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b)
def cr(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
def over(top,a,bot): return tuple(round(t*a+b*(1-a),2) for t,b in zip(top,bot))
W=(255,255,255)
# dark: page stops -> card 0.055 white -> sub 0.05 white
dark_bgs={s: over(W,0.05,over(W,0.055,hx(s))) for s in ['#080c18','#0b1020','#090e1a']}
light_bg={'#f8fafc':hx('#f8fafc')}
cur_light={'court':'#025afb','care':'#0b2d85','well':'#5c736e','drive':'#026add','pets':'#b0533e','work':'#b15401','park':'#ce330a','learn':'#035848','law':'#85694d','home':'#1b252e','food':'#b91c1c','stay':'#3f5573','ride':'#0369a1'}
import re
cur_dark={'court':'#2c75fc','care':'#667cb3','well':'#75918b','drive':'#137bed','pets':'#f47356','work':'#fd7802','park':'#ed3b0c','learn':'#4b877c','law':'#c69d73','home':'#787e84'}
print("dark bgs", {k:tuple(round(x) for x in v) for k,v in dark_bgs.items()})
def worst(fg,bgs): return min(cr(hx(fg),b) for b in bgs)
print("PROPOSED light #0f172a on #f8fafc: %.2f"%cr(hx('#0f172a'),hx('#f8fafc')))
print("PROPOSED dark #f1f5f9 worst: %.2f"%worst('#f1f5f9',dark_bgs.values()))
print("ALT dark #ffffff worst: %.2f"%worst('#ffffff',dark_bgs.values()))
print("logo #fff vs #f1f5f9: %.3f"%cr(hx('#ffffff'),hx('#f1f5f9')))
for k,v in cur_light.items(): print("cur light",k,v,"%.2f"%cr(hx(v),hx('#f8fafc')))
for k,v in cur_dark.items(): print("cur dark",k,v,"%.2f"%worst(v,dark_bgs.values()))
for k,v in {'food':'#fca5a5','ride':'#7dd3fc','stay':'#a8c0dc'}.items(): print("cur dark",k,v,"%.2f"%worst(v,dark_bgs.values()))
