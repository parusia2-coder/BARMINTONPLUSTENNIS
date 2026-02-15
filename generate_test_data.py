import random

# 한국 성씨 (빈도순)
last_names = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전','홍','고','문','양','손','배','백','허','유','남','심','노','하','곽','성','차','주','우','구','민','진','나','엄','원','천','방','공','현','함']

# 남자 이름 글자
male_first = ['민수','정호','승우','현우','태현','재혁','성준','도윤','준혁','지훈','영수','동현','진우','상현','세준','시우','예준','하준','서준','도현','주원','건우','현준','유준','지호','준서','민재','우진','은호','시현','태윤','민호','석현','승민','기현','재원','동욱','영진','성호','준영','민규','경수','형진','지성','원석','태민','승현','대호','종혁','찬호']

# 여자 이름 글자
female_first = ['서연','유진','다영','지민','수빈','미래','하늘','서윤','지은','민지','수정','예진','은지','하영','소영','연주','혜진','진아','수현','윤아','채원','지영','미선','소연','가은','나연','주희','은서','다은','지현','예은','하은','서현','윤서','민서','채은','지아','서영','유나','하린','소희','예린','도연','시은','아린','수아','지원','은채','채린','미영']

levels = ['s','a','a','b','b','b','c','c','c','c','d','d','d','e','e']
# 급수 분포: S 약간, A 좀더, B/C 많이, D 중간, E 적당

participants = []
used_names = set()

# 남자 55명, 여자 45명
for i in range(100):
    if i < 55:
        gender = 'm'
        firsts = male_first
    else:
        gender = 'f'
        firsts = female_first
    
    # 고유 이름 생성
    while True:
        last = random.choice(last_names)
        first = random.choice(firsts)
        name = last + first
        if name not in used_names:
            used_names.add(name)
            break
    
    birth = random.randint(1970, 2002)
    level = random.choice(levels)
    phone = f'010-{random.randint(1000,9999)}-{random.randint(1000,9999)}'
    
    g_label = '남' if gender == 'm' else '여'
    participants.append(f'{name}, {g_label}, {birth}, {level.upper()}, {phone}')

# Print for text paste format
print('\n'.join(participants))
