# Analiza Tech Stack: OpenCode i OhMyOpenCode — Podstawa Architektury Nowego Projektu Proxy AI

## 1. Charakterystyka Analizowanych Frameworków

### 1.1 OpenCode (anomalyco/opencode)

#### 1.1.1 Profil projektu i znaczenie w ekosystemie

**OpenCode** reprezentuje jeden z najbardziej znaczących projektów w dziedzinie open-source’owych agentów kodujących opartych na sztucznej inteligencji. Z **108 tysiącami gwiazdek** na GitHubie i **10,7 tysiącami forków**, projekt ten zbudował imponującą społeczność składającą się z **768 aktywnych kontrybutorów**, co świadczy o jego dojrzałości i szerokim zaadoptowaniu w środowisku deweloperskim [(Github)](https://github.com/anomalyco/opencode) . Repozytorium zawiera **9 617 commitów**, co wskazuje na intensywny rozwój i ciągłe doskonalenie kodu. Data ostatniej aktywności z **21 lutego 2026 roku** potwierdza, że projekt jest żywy i aktywnie rozwijany, co ma kluczowe znaczenie dla decyzji o jego wykorzystaniu jako fundamentu nowej architektury.

Projekt został stworzony przez zespół **Anomaly**, znany również z **terminal.shop**, co sugeruje głębokie zrozumienie potrzeb deweloperów pracujących w środowisku terminalowym. OpenCode pozycjonuje się jako **bezpośrednia, otwarta alternatywa dla zamkniętych rozwiązań** takich jak Claude Code, zachowując przy tym pełną niezależność od dostawców modeli AI. Architektura **klient/serwer** zaimplementowana w OpenCode umożliwia nie tylko lokalne działanie w terminalu, ale także **zdalne sterowanie z poziomu aplikacji mobilnych**, co otwiera interesujące możliwości dla modułu webowego planowanego w nowym projekcie [(Github)](https://github.com/anomalyco/opencode) .

Wsparcie dla **Language Server Protocol (LSP)** stanowi jedną z kluczowych przewag konkurencyjnych OpenCode. Automatyczne ładowanie odpowiednich serwerów LSP dla danego języka programowania pozwala modelom językowym na **precyzyjniejsze zrozumienie kontekstu kodu**, co przekłada się na wyższą jakość generowanych sugestii i refaktoryzacji. Funkcja **multi-session** umożliwia równoległe uruchamianie wielu agentów na tym samym projekcie, co bezpośrednio inspiruje funkcjonalność **równoległych zapytań do tego samego modelu z różnych subskrypcji** planowaną w module proxy nowego projektu [(opencode.ai)](https://opencode.ai/) .

#### 1.1.2 Szczegółowy rozkład stacku technologicznego

Analiza repozytorium OpenCode ujawnia wyraźnie zdefiniowany stack technologiczny, który odzwierciedla priorytety projektu: **nowoczesność, typowanie i wydajność**. Poniższa tabela przedstawia szczegółowy rozkład języków programowania wykorzystanych w projekcie:

| Język/Technologia | Udział procentowy | Rola w projekcie | Implikacje dla nowego projektu |
| --- | --- | --- | --- |
| **TypeScript** | **51.3%** | Główny język implementacji | Bezpośrednia reużywalność kodu, silne typowanie |
| **MDX** | **44.5%** | Dokumentacja, treści, konfiguracje | Elastyczny system dokumentacji agentów |
| **CSS** | **3.2%** | Stylizacja interfejsu TUI | Ograniczone — TUI priorytetowe nad GUI |
| **Rust** | **0.5%** | Komponenty wydajnościowe krytyczne | Rozważyć dla parserów i hot paths |
| **Astro** | **0.2%** | Statyczne strony dokumentacji | Opcjonalnie dla webowego interfejsu |
| **JavaScript** | **0.1%** | Legacy compatibility | Minimalny, do eliminacji |
| **Inne** | **0.2%** | Konfiguracje, skrypty | Niekrytyczne |

Dominacja **TypeScriptu na poziomie 51.3%** stanowi kluczową informację dla architekta nowego projektu. Jest to świadomy wybór zespołu Anomaly, który postawił na **silne typowanie jako fundament niezawodności kodu** współpracującego z modelami językowymi. TypeScript umożliwia **wczesne wykrywanie błędów na etapie kompilacji**, co jest szczególnie istotne w kontekście dynamicznie generowanego kodu przez AI — dokładnie ten scenariusz, który użytkownik chce obsługiwać w module proxy z niepodważalnymi zasadami (hookami) [(Github)](https://github.com/anomalyco/opencode) .

**MDX** jako drugi co do wielkości komponent (44.5%) jest technologią godną uwagi. Połączenie Markdown z JSX umożliwia tworzenie **bogatych, interaktywnych dokumentacji agentów**, które mogą zawierać osadzony kod, komponenty React i dynamiczne elementy. W kontekście nowego projektu, gdzie **zapominanie promptów i dokumentacji w commands/agents stanowi wyraźnie zidentyfikowany problem**, MDX może posłużyć jako format dla niepodważalnych zasad — hooków, które będą zarówno czytelne dla ludzi, jak i przetwarzalne maszynowo.

Obecność **Rust w 0.5%** repozytorium, choć niewielka procentowo, sygnalizuje **strategiczne podejście do optymalizacji**. Rust został prawdopodobnie wykorzystany w komponentach, gdzie wydajność ma krytyczne znaczenie — parserach, transformatorach kodu, lub modułach przetwarzających duże wolumeny danych. Dla nowego projektu proxy AI, gdzie **efektywność zarządzania kontekstem i tokenami będzie kluczowa**, rozważenie Rust dla wybranych komponentów (np. parser kontekstu, kompresja promptów) pozostaje uzasadnioną opcją.

#### 1.1.3 Struktura monorepo i organizacja kodu

Repozytorium OpenCode przyjmuje **klasyczną strukturę monorepo**, która skaluje się wraz z rozwojem projektu i umożliwia modularne zarządzanie zależnościami. Kluczowe katalogi i ich przeznaczenie:

| Katalog | Przeznaczenie | Lekcja dla nowego projektu |
| --- | --- | --- |
| packages/ | Rozdzielone, niezależnie wersjonowane pakiety | **Adoptować bezpośrednio** — izolacja odpowiedzialności |
| sdks/vscode/ | Oficjalne rozszerzenie VS Code | Wzorzec separacji core od interfejsu |
| infra/ | Infrastruktura i deployment (SST) | Dojrzałe podejście DevOps |
| script/ | Automatyzacja build, publish, release | Zaawansowane pipeline’y CI/CD |
| specs/ | Specyfikacje i testy | Specification-by-example dla hooków |

**Katalog packages/** stanowi serce modularnej architektury. Zawiera on rozdzielone, niezależnie wersjonowane pakiety, które mogą być publikowane osobno do rejestrów npm. Taka organizacja ułatwia: **izolację odpowiedzialności między komponentami**, **niezależne cykle wydawnicze dla różnych modułów**, **selektywną reużywalność** — nowy projekt może zaimportować tylko potrzebne pakiety, oraz **równoległy rozwój przez zespoły**.

**Katalog sdks/vscode/** zawiera oficjalne rozszerzenie dla Visual Studio Code, co demonstruje, **jak ten sam core może być opakowany w różne interfejsy użytkownika**. Dla nowego projektu z modułem webowym, ten **wzorzec separacji core od interfejsu** jest bezpośrednio aplikowalny.

**Katalog infra/** odpowiada za infrastrukturę i deployment, z wykorzystaniem **SST (Serverless Stack)** — frameworka do budowania aplikacji serverless na AWS. To wskazuje na **dojrzałe podejście do DevOps** i gotowość do skalowania w środowisku chmurowym.

**Katalog script/** agreguje skrypty automatyzujące procesy build, publish i release. Obecność tego katalogu sugeruje **zaawansowane pipeline’y CI/CD**, które nowy projekt również powinien rozważyć.

**Katalog specs/** przechowuje specyfikacje i testy, prawdopodobnie w formacie umożliwiającym generowanie dokumentacji i weryfikację implementacji. To podejście **specification-by-example** może inspirować definicję niepodważalnych zasad w module hooków [(Github)](https://github.com/anomalyco/opencode) .

#### 1.1.4 Architektura klient/serwer i jej implikacje

Dokumentacja OpenCode wyraźnie podkreśla **architekturę klient/serwer jako fundamentalną cechę projektu**. Ta decyzja architektoniczna ma głębokie konsekwencje dla nowego projektu proxy AI:

| Aspekt architektury | Implementacja w OpenCode | Adaptacja dla nowego projektu |
| --- | --- | --- |
| **Separacja concerns** | Serwer: logika biznesowa, AI, sesje; Klient: prezentacja | **Identyczna separacja** — proxy (serwer) + web (klient) |
| **Multi-client readiness** | Terminal, IDE, mobile → jeden serwer | Web + potencjalnie CLI/API współdzielą backend |
| **Remote execution** | Lokalny serwer, zdalne sterowanie | Edge computing: ciężki proxy w chmurze, lekki web lokalnie |

**Separacja concerns**: Serwer odpowiada za logikę biznesową, komunikację z modelami AI, zarządzanie sesjami i kontekstem. Klient (TUI, IDE extension, desktop app) zajmuje się wyłącznie prezentacją i interakcją. Ta separacja jest **bezpośrednio mapowalna na podział nowego projektu na moduł proxy (serwer) i moduł webowy (klient)**.

**Multi-client readiness**: Ta sama instancja serwera może obsługiwać równocześnie terminal, IDE i aplikację mobilną. Dla modułu webowego nowego projektu oznacza to, że **interfejs do orchestratora może współdzielić backend z innymi potencjalnymi klientami** (CLI, API dla zewnętrznych integracji).

**Remote execution**: Możliwość uruchamiania OpenCode na jednej maszynie i sterowania nim z innej otwiera scenariusze **edge computing i distributed development**. W kontekście proxy AI, może to oznaczać **uruchamianie “ciężkiego” serwera proxy w chmurze, z lekkim webowym interfejsem lokalnie** [(Github)](https://github.com/anomalyco/opencode) .

### 1.2 OhMyOpenCode (code-yeongyu/oh-my-opencode)

#### 1.2.1 Profil projektu i pozycjonowanie rynkowe

**OhMyOpenCode** funkcjonuje jako **wyspecjalizowana warstwa orkiestracji** zbudowana bezpośrednio na fundamencie OpenCode. Projekt ten, prowadzony przez **code-yeongyu**, zyskał znaczącą popularność jako **“najlepszy harness dla agentów”** (the best agent harness), oferując **produkcyjną gotowość** tam, gdzie sam OpenCode dostarcza jedynie fundamenty. Repozytorium zawiera **60 tysięcy gwiazdek** i rozwija się w ekosystemie **500+ kontrybutorów**, co czyni je znaczącym graczem w przestrzeni open-source’owych narzędzi AI [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

Kluczową różnicą w stosunku do bazowego OpenCode jest focus na **opiniowane defaults** i **batteries-included approach**. Podczas gdy OpenCode wymaga konfiguracji i dostosowania do konkretnych workflow’ów, OhMyOpenCode dostarcza **gotowe do użycia rozwiązania**, które “po prostu działają”. To podejście jest szczególnie atrakcyjne dla zespołów, które nie chcą inwestować czasu w fine-tuning konfiguracji, ale oczekują **natychmiastowej produktywności** [(The Best Agent Harness)](https://ohmyopencode.com/) .

Projekt wyraźnie pozycjonuje się jako **alternatywa dla zamkniętych ekosystemów**, szczególnie tych oferowanych przez Anthropic. Autorzy nie ukrywają kontrowersyjnej historii: *“Anthropic zablokował OpenCode z powodu nas”* — to stwierdzenie w README podkreśla **radykalne zaangażowanie w otwartość i niezależność od pojedynczych dostawców**. Filozofia **“The future isn’t picking one winner—it’s orchestrating them all”** (Przyszłość to nie wybór jednego zwycięzcy — to orkiestracja wszystkich) **rezonuje bezpośrednio z celem nowego projektu: inteligentnego przełączania między subskrypcjami AI i równoległego wykorzystania wielu dostawców** [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

#### 1.2.2 Jednolity stack TypeScript — analiza głęboka

OhMyOpenCode przyjmuje **czystość technologiczną na poziomie 100% TypeScript**, co stanowi drastyczny kontrast z bardziej zróżnicowanym stackiem OpenCode. Ta decyzja ma wielowymiarowe uzasadnienie:

| Aspekt | Uzasadnienie 100% TypeScript | Korzyść dla nowego projektu |
| --- | --- | --- |
| **Konsystencja z ekosystemem** | Plugin dla TypeScriptowego OpenCode | **Maksymalna reużywalność kodu** |
| **Developer experience** | Najlepsze wsparcie dla AI-assisted development | **AI lepiej łapie błędy wcześniej** |
| **Tooling ecosystem** | Dojrzałe narzędzia do analizy, refaktoryzacji, generowania kodu | Szybszy development, mniej błędów |

**Konsystencja z ekosystemem**: Jako plugin dla OpenCode, który sam w 51.3% opiera się na TypeScript, OhMyOpenCode **maksymalizuje reużywalność kodu i interoperacyjność**. Wspólny język umożliwia **bezpośrednie importy, współdzielenie typów i płynne debugowanie przez stos technologiczny**.

**Developer experience**: TypeScript oferuje **najlepsze wsparcie dla AI-assisted development** spośród dostępnych języków. Silne typowanie umożliwia modelom językowym (i ich programistom-humanom) **precyzyjne zrozumienie kontraktów między komponentami**, co przyspiesza development i redukuje błędy.

**Tooling ecosystem**: Ekosystem TypeScript oferuje **najbardziej dojrzałe narzędzia do analizy statycznej, refaktoryzacji i generowania kodu** — wszystko kluczowe dla projektu, który sam ma wspierać development wspomagany przez AI [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

Dla nowego projektu, **czystość stacku OhMyOpenCode stanowi istotną zaletę: kod tego projektu może być kopiowany i adaptowany bez konieczności tłumaczenia między językami** czy radzenia sobie z FFI (Foreign Function Interface). Każda linia kodu OhMyOpenCode jest potencjalnie reużywalna w nowym projekcie.

#### 1.2.3 Szczegółowa analiza kluczowych rozszerzeń funkcjonalnych

OhMyOpenCode wprowadza szereg innowacji, które **bezpośrednio inspirują funkcjonalności planowane w nowym projekcie proxy AI**:

| Rozszerzenie | Opis | Adaptacja dla modułu proxy |
| --- | --- | --- |
| **Sisyphus** | Główny agent orkiestracyjny — “nie zatrzymuje się w połowie” | **Logika agresywnego retry i fallback** |
| **Ultrawork (ultrawork / ulw)** | Jednowyrazowa aktywacja wszystkich agentów | **Komenda inicjująca równoległe zapytania** |
| **Hash-Anchored Edit Tool** | Precyzyjne modyfikacje przez hashe zawartości, nie numery linii | **Hash-anchored references dla kontekstu** |
| **Background Agents** | 5+ specjalistycznych agentów równolegle, “lean context” | **Równoległe zapytania do tego samego modelu** |
| **Skill-Embedded MCPs** | Umiejętności niosą własne serwery MCP, scoped do zadania | **Dynamiczne ładowanie umiejętności, czyste okno kontekstu** |

**Sisyphus — główny agent orkiestracyjny**: Nazwany na cześć postaci z mitologii greckiej skazanej na wieczną pracę, Sisyphus reprezentuje filozofię **“nie zatrzymuje się w połowie”**. Agent ten planuje, deleguje do specjalistów i dąży do ukończenia zadań z **agresywnym wykonywaniem równoległym**. Dla modułu proxy, koncepcja Sisyphusa może być zaadaptowana jako **logika, która nie akceptuje pojedynczych awarii providera, ale agresywnie retry-uje i fallback-uje do alternatyw** [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

**Ultrawork (ultrawork / ulw) — jednowyrazowa aktywacja**: Ta funkcjonalność demonstruje potęgę dobrze zaprojektowanej abstrakcji. Jedno słowo aktywuje wszystkich agentów, którzy **“nie zatrzymują się, dopóki nie skończą”**. W kontekście proxy AI, można wyobrazić sobie podobną komendę, która **inicjuje równoległe zapytania do wielu subskrypcji z automatycznym agregowaniem wyników** [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

**Hash-Anchored Edit Tool — precyzyjna modyfikacja kodu**: Rozwiązanie inspirowane projektem oh-my-pi, które adresuje **“problem harnessu”** opisany przez Cana Bölüka. Każda linia kodu czytana przez agenta zwracana jest z **tagiem hasha zawartości** (11#VK: function hello()). Agent edytuje, odwołując się do tych tagów, a nie numerów linii. Jeśli plik uległ zmianie, hash nie zgadza się i edycja jest **odrzucona przed skorumpowaniem**. Ta technika osiągnęła **wzrost skuteczności z 6.7% do 68.3% w benchmarku Grok Code Fast 1** — **poprawa o rząd wielkości wynikająca wyłącznie ze zmiany narzędzia edycji** [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

Dla nowego projektu, koncepcja **hash-anchored references** może być zaadaptowana do zarządzania kontekstem: zamiast przekazywać cały, potencjalnie przestarzały kontekst do modelu, proxy mogłoby **przekazywać hashe weryfikujące aktualność poszczególnych fragmentów**, oszczędzając tokeny i zwiększając niezawodność.

**Background Agents — agenci działający w tle**: OhMyOpenCode umożliwia uruchamianie **5+ specjalistycznych agentów równolegle**, przy zachowaniu **“lean context”** — rezultaty dostępne, gdy będą gotowe. To **bezpośrednio mapuje się na wymaganie nowego projektu: “używanie tego samego modelu z różnych subskrypcji w tym samym momencie, czyli szybsze działanie”** [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

**Skill-Embedded MCPs — wbudowane umiejętności przez Model Context Protocol**: MCP (Model Context Protocol) to standard komunikacji między agentami AI a zewnętrznymi narzędziami. OhMyOpenCode innowuje, pozwalając **skillom niesienie własnych serwerów MCP**, które **spin-up-ują się na żądanie, są scoped do zadania i znikają, gdy nie są potrzebne**. To rozwiązanie **“context window stays clean”** jest kluczowe dla **efektywnego zarządzania tokenami** — dokładnie ten problem, który użytkownik identyfikuje w module proxy [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

#### 1.2.4 System hooków i niepodważalne zasady

OhMyOpenCode implementuje **rozbudowany system hooków**, który jest najbliższym odpowiednikiem **“niepodważalnych zasad”** (hooków, których nigdy nie można pominąć ani zapomnieć) wymaganych w nowym projekcie. Dokumentacja wspomina o **25+ wbudowanych hookach**, wszystkich konfigurowalnych przez disabled\_hooks [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

| Etap cyklu życia | Przykładowe hooki | Funkcja w systemie |
| --- | --- | --- |
| **Pre-processing** | Modyfikacja promptu, walidacja wejścia | Przygotowanie zapytania |
| **Context injection** | AGENTS.md, README.md, conditional rules | **Wymuszone wstrzykiwanie kontekstu** |
| **Post-processing** | Analiza odpowiedzi, transformacja formatu | Obróbka wyniku |
| **Error recovery** | Automatyczna obsługa błędów, kontynuacja sesji | **Niepodważalna odporność na awarie** |

Hooki w OhMyOpenCode operują na różnych etapach cyklu życia zapytania, z **Context injection** jako kluczowym mechanizmem zapobiegającym zapominaniu dokumentacji. Dla nowego projektu, ten **wzorzec hooków stanowi gotowy blueprint do implementacji “niepodważalnych zasad”**. Każdy hook może być **typowany w TypeScript, z walidacją na etapie kompilacji**, że żaden krytyczny hook nie zostanie przypadkowo pominięty.

## 2. Wnioski dla Nowego Projektu Proxy AI

### 2.1 Rekomendowany język główny — uzasadnienie wielowymiarowe

#### 2.1.1 TypeScript jako jednolity wybór architektoniczny

Na podstawie głębokiej analizy obu frameworków źródłowych, **TypeScript wybiera się jako jedyny język implementacji dla nowego projektu proxy AI**. Ta rekomendacja opiera się na czterech filarach:

| Filar | Uzasadnienie | Konkretna korzyść |
| --- | --- | --- |
| **Kongruencja z ekosystemem źródłowym** | 51.3% OpenCode + 100% OhMyOpenCode | **Bezpośrednia reużywalność kodu** z OhMyOpenCode |
| **Silne typowanie jako wymaganie funkcjonalne** | Wyraźne żądanie użytkownika | **AI łapie błędy wcześniej**, precyzyjne kontrakty |
| **AI-assisted development readiness** | Projekt sam wspiera AI-assisted dev | Typy jako “dokumentacja wykonywalna” |
| **Ekosystem i tooling** | Najbogatszy wybór bibliotek | Szybki start, dojrzałe rozwiązania |

**Kongruencja z ekosystemem źródłowym**: Zarówno OpenCode (51.3%), jak i OhMyOpenCode (100%) opierają się na TypeScript. Wybór tego samego języka **maksymalizuje szanse na bezpośrednią reużywalność kodu**, szczególnie z OhMyOpenCode, gdzie **cała logika orkiestracji, system hooków i integracje MCP są już zaimplementowane w TypeScript**. Kopiowanie “ile się da” staje się **technicznie wykonalne, a nie tylko aspiracyjne** [(Github)](https://github.com/code-yeongyu/oh-my-opencode) .

**Silne typowanie jako wymaganie funkcjonalne**: Użytkownik wyraźnie żąda **“możliwie lekkiego i prostego rozwiązania, z silnym typowaniem, aby AI lepiej łapało błędy wcześniej”**. TypeScript oferuje **najbardziej dojrzały system typów** wśród języków szeroko stosowanych w developmentie webowym. System typów TypeScript: **wykrywa błędy na etapie kompilacji**, zanim kod zostanie uruchomiony; **umożliwia precyzyjne modelowanie domeny** (subskrypcje AI, modele, konteksty, hooki); **wspiera generyki i conditional types** dla elastycznych, ale bezpiecznych abstrakcji; oferuje **najlepsze wsparcie IDE** (IntelliSense, refaktoryzacja) spośród języków dynamicznie typowanych.

**AI-assisted development readiness**: TypeScript został zaprojektowany z myślą o **skalowalności i czytelności kodu** — cech kluczowych, gdy duża część kodu może być generowana przez AI. **Silne typowanie działa jako “dokumentacja wykonywalna”**, która pomaga modelom językowym zrozumieć zamierzone użycie API bez potrzeby analizowania implementacji. To bezpośrednio **adresuje problem “zapominania promptów i dokumentacji”** — typy same w sobie stanowią formę niepodważalnej dokumentacji.

**Ekosystem i tooling**: Ekosystem TypeScript oferuje **najbogatszy wybór bibliotek** do: walidacji schematów (Zod, Valibot, Yup); obsługi HTTP i WebSocket (native fetch, ws, Socket.io); testowania (Vitest, Jest); budowania i bundling (esbuild, rollup, vite).

#### 2.1.2 Strategiczne zastosowanie Rust dla komponentów krytycznych

Mimo dominacji TypeScript, analiza OpenCode sugeruje miejsce dla **Rust w 0.5% repozytorium** — komponenty, gdzie wydajność ma krytyczne znaczenie [(Github)](https://github.com/anomalyco/opencode) . Dla nowego projektu proxy AI, rozważyć Rust dla:

| Scenariusz | Uzasadnienie Rust | Szacowany udział |
| --- | --- | --- |
| **Parser kontekstu i kompresja promptów** | Zero-cost abstractions, kontrola alokacji | **2-5%** |
| **Transformacje formatów (Markdown ↔ JSON)** | SIMD, równoległość bez GIL | **1-3%** |
| **Hot paths w routing’u zapytań** | Predictable performance, brak GC pauses | **1-2%** |
| **Kryptografia (hash-e weryfikacyjne)** | Audytowalne, bezpieczne implementacje | **<1%** |

Integracja Rust z TypeScript może odbywać się przez: **napi-rs** — bindings dla Node.js z minimalnym overhead; **WASM** — kompilacja do WebAssembly dla przenośności i sandboxing; **External process** — Rust jako oddzielny mikroserwis komunikujący się przez gRPC/HTTP.

### 2.2 Architektura modułowa projektu — szczegółowy projekt

#### 2.2.1 Moduł Proxy Subskrypcji — serce systemu

Moduł proxy subskrypcji stanowi **priorytetową implementację**, inspirowaną LiteLLM proxy, ale **dedykowaną specyficznym potrzebom pracy z orchestratorem**. Szczegółowa specyfikacja funkcjonalna:

| Funkcja | Opis | Mechanizm implementacji |
| --- | --- | --- |
| **Inteligentne przełączanie między subskrypcjami AI** | Routing oparty na dostępności, koszcie, jakości, latency | Health checki + konfigurowalne strategie |
| **Retry z fallbackiem** | Detekcja timeout, hangup, rate limit, 5xx | Exponential backoff + circuit breaker |
| **Równoległe zapytania do tego samego modelu** | Race mode, consensus mode, cost mode | Promise.race / Promise.all + agregacja |
| **Zarządzanie kontekstem** | Kompresja, lazy loading, token budgeting | Hash-anchored refs + summarization |

**Inteligentne przełączanie między subskrypcjami AI**: Routing oparty na **dostępności, koszcie, jakości i latency**; **Health checki providerów** z exponential backoff; **Konfigurowalne strategie**: priority-based, round-robin, cost-optimized, quality-optimized.

**Retry z fallbackiem do alternatywnych providerów**: **Detekcja błędów**: timeout, hangup, rate limit, 5xx errors, invalid responses; **Automatyczne ponawianie** z jitter i exponential backoff; **Fallback do backup providera** po wyczerpaniu retry attempts; **Circuit breaker** dla chronicznie niedostępnych providerów.

**Równoległe zapytania do tego samego modelu z różnych subskrypcji**: **Race mode**: pierwsza odpowiedź wygrywa, reszta anulowana; **Consensus mode**: wszystkie odpowiedzi, agregacja przez voting lub averaging (dla probabilistycznych wyjść); **Cost mode**: równoległe zapytania do najtańszych providerów, wybór najlepszego stosunku jakość/koszt.

**Zarządzanie kontekstem — oszczędność tokenów**: **Kompresja kontekstu** przez deduplikację i summarization; **Lazy loading**: ładowanie tylko potrzebnych fragmentów kontekstu; **Invalidation cache** oparta na hash-anchored references (inspiracja z OhMyOpenCode); **Token budgeting**: hard i soft limity per zapytanie, per użytkownik, per projekt.

#### 2.2.2 System Hooków — niepodważalne zasady

System hooków adresuje **fundamentalny problem zidentyfikowany przez użytkownika**: “często trzymane prompty i dokumentacje w commands, agents itp. są zapominane”. Architektura hooków:

┌─────────────────────────────────────┐  
│ Layer 4: Post-processing hooks │ ← Transformacja, logowanie, cache  
│ (zawsze wykonywane) │  
├─────────────────────────────────────┤  
│ Layer 3: Core proxy logic │ ← Routing, retry, fallback  
│ (niepodważalne) │  
├─────────────────────────────────────┤  
│ Layer 2: Pre-processing hooks │ ← Wstrzykiwanie kontekstu, walidacja  
│ (zawsze wykonywane) │  
├─────────────────────────────────────┤  
│ Layer 1: Input validation │ ← Schema validation, sanitization  
│ (zawsze wykonywane) │  
└─────────────────────────────────────┘

**Typowanie hooków w TypeScript** (inspiracja z OhMyOpenCode):

interface Hook<TInput, TOutput> {  
 readonly id: string;  
 readonly priority: number; // Determinuje kolejność  
 readonly isCritical: boolean; // Czy hook niepodważalny  
   
 execute(input: TInput, context: HookContext): Promise<TOutput>;  
 onFailure?(error: Error, context: HookContext): FailureAction;  
}  
  
type FailureAction =   
 | { type: 'abort'; reason: string }  
 | { type: 'retry'; delayMs: number }  
 | { type: 'fallback'; to: string };

**Kategorie hooków**: **Context injection** — automatyczne wstrzykiwanie AGENTS.md, dokumentacji projektu, reguł specyficznych dla języka; **Validation** — schema validation dla wejść i wyjść, sanity checks dla token usage; **Transformation** — normalizacja formatów odpowiedzi, kompresja/dekompresja kontekstu; **Observability** — logging, metrics, tracing dla każdego zapytania; **Safety** — rate limiting, quota enforcement, content filtering.

#### 2.2.3 Moduł Webowy do Orchestracji — separacja odpowiedzialności

Moduł webowy stanowi **oddzielny, samodzielny komponent** odpowiedzialny wyłącznie za **interfejs użytkownika do komunikacji z orchestratorem**. Kluczowe zasady projektowe:

| Zasada | Implementacja | Korzyść |
| --- | --- | --- |
| **Czysta separacja** | Web ↔ Proxy przez API, nie bezpośrednie wywołania | Niezależny rozwój i deployment |
| **Multi-client readiness** | Potencjalnie CLI, IDE extension, API | Współdzielony backend, różne fronty |
| **Architektura inspirowana OpenCode** | Client/server z zdalnym sterowaniem | Edge computing, distributed development |

**Czysta separacja**: Moduł webowy **nie implementuje logiki proxy** — komunikuje się z modułem proxy przez **dobrze zdefiniowane API**. Ta separacja umożliwia: **niezależny rozwój i deployment** obu modułów; **wielokrotne interfejsy** (web, CLI, IDE extension) współdzielące ten sam backend; **łatwiejsze testowanie i mockowanie**.

**Architektura inspirowana OpenCode**: Client/server z możliwością **zdalnego sterowania**. Serwer proxy może działać w chmurze lub na potężnej stacji roboczej, podczas gdy **lekki interfejs webowy dostępny jest z dowolnego urządzenia**.

### 2.3 Stack technologiczny — szczegółowe rekomendacje

#### 2.3.1 Runtime i język — analiza opcji

| Runtime | Zalety | Wady | Rekomendacja |
| --- | --- | --- | --- |
| **Node.js 20+ LTS** | Najszerszy ekosystem, doskonałe wsparcie TypeScript, znajomość | Event loop, GC pauses | **Domyślny wybór** |
| **Deno 2+** | Wbudowane TypeScript, bezpieczne defaults, modern APIs | Mniejszy ekosystem, breaking changes history | Rozważyć dla greenfield |
| **Bun 1.1+** | Najwyższa wydajność, kompatybilność z Node API, bundler built-in | Młodszy projekt, mniej battle-tested | Dla performance-critical paths |

Rekomendacja: **Node.js 20+ LTS** jako domyślny runtime, z możliwością migracji wybranych komponentów do Bun po udowodnieniu potrzeby wydajnościowej.

#### 2.3.2 Framework webowy — porównanie szczegółowe

| Framework | Filozofia | Wydajność | Typowanie | Inspiring project |
| --- | --- | --- | --- | --- |
| **Hono** | Lekki, middleware-based, Edge-ready | **Bardzo wysoka** | **Excellent** | **Wzorzec LiteLLM** |
| **Elysia** | Bun-native, end-to-end type safety | **Najwyższa** | **Superior** (jeśli Bun) | Nowoczesny design |
| **Fastify** | Plugin-based, enterprise-ready | Wysoka | Very good | Stabilność, dojrzałość |
| **Express** | Minimalny, wszechobecny | Dobra | Wymaga dodatków | Legacy compatibility |

Rekomendacja: **Hono** jako pierwszy wybór — **lekkość zgodna z wymaganiem “możliwie lekkie i proste”**, doskonałe typowanie, i **bezpośrednia inspiracja z LiteLLM**, którego wzorzec użytkownik chce naśladować.

#### 2.3.3 Zarządzanie stanem i konfiguracją — walidacja schematów

| Biblioteka | Rozmiar | Features | Type inference | Rekomendacja |
| --- | --- | --- | --- | --- |
| **Zod** | ~12kB | Pełna funkcjonalność, ecosystem | **Excellent** | **Domyślny wybór** |
| **Valibot** | ~3kB | Modular, tree-shakeable | Very good | Dla maksymalnej lekkości |
| **ArkType** | ~8kB | Runtime validation + TS performance | Superior | Rozważyć dla złożonych schematów |

**Zod** oferuje najlepszy balans między funkcjonalnością a ekosystemem. Przykład użycia dla konfiguracji proxy:

import { z } from 'zod';  
  
const SubscriptionSchema = z.object({  
 id: z.string().uuid(),  
 provider: z.enum(['openai', 'anthropic', 'google', 'local']),  
 model: z.string(),  
 apiKey: z.string().min(1),  
 baseUrl: z.url().optional(),  
 priority: z.number().int().min(1).max(100),  
 rateLimit: z.object({  
 requestsPerMinute: z.number().int().positive(),  
 tokensPerMinute: z.number().int().positive(),  
 }).optional(),  
});  
  
type Subscription = z.infer<typeof SubscriptionSchema>;  
// Typ Subscription jest w pełni inferowany z schematu

#### 2.3.4 Komunikacja z AI providers — abstrakcja i kontrola

| Opcja | Abstrakcja | Kontrola | Typowanie | Złożoność |
| --- | --- | --- | --- | --- |
| **Vercel AI SDK** | **Wysoka** | Średnia | **Excellent** | **Niska** |
| **Native fetch + typowane wrappery** | **Niska** | **Pełna** | Manualna | Średnia |
| **LangChain** | Bardzo wysoka | Ograniczona | Dobra | **Wysoka** |
| **LlamaIndex** | Wysoka (RAG-focused) | Średnia | Dobra | Wysoka |

Rekomendacja: **Vercel AI SDK** dla szybkiego startu i standardowych przypadków użycia, z możliwością fallback do **native fetch + typowane wrappery** dla niestandardowych providerów lub specyficznych wymagań. **Unikać LangChain** ze względu na złożoność nieproporcjonalną do potrzeb.

#### 2.3.5 Obsługa równoległości i retry — utility i frameworki efektów

| Narzędzie | Przeznaczenie | Zalety | Wady |
| --- | --- | --- | --- |
| **p-retry** | Prosty retry z exponential backoff | Prosty, sprawdzony | Ograniczona funkcjonalność |
| **p-timeout** | Timeout dla Promise | Lekki, komponowalny | Tylko timeout |
| **p-queue** | Ograniczenie współbieżności | Kontrola resource usage | Dodatkowa zależność |
| **Effect-TS** | Złożona logika efektów i błędów | Pełna kontrola, composability | Krzywa uczenia, verbose |

Rekomendacja: Rozpocząć od **p-retry + p-timeout + p-queue** — sprawdzone utility z ekosystemu **Sindre Sorhus**, które oferują **80% funkcjonalności przy 20% złożoności**. Rozważyć **Effect-TS** tylko jeśli logika błędów stanie się znacząco złożona (więcej niż 3-4 warstwy abstrakcji).

### 2.4 Strategia reuse’u kodu źródłowego — szczegółowy plan

#### 2.4.1 Z OhMyOpenCode (TypeScript 100%) — maksymalny reuse

| Komponent | Poziom reuse | Uzasadnienie | Szacowany wysiłek adaptacji |
| --- | --- | --- | --- |
| **System hooków** | **Bezpośredni** | 100% TypeScript, identyczna koncepcja | **Niski** — głównie rename |
| **Logika workflow (Sisyphus)** | **Wysoki** | Abstrakcja agentów aplikowalna do providerów | **Średni** — adaptacja domeny |
| **Integracje MCP** | **Bezpośredni** | Standardowy protokół, gotowe implementacje | **Niski** |
| **Background task management** | **Wysoki** | Równoległość identyczna z wymaganiem | **Średni** — adaptacja do HTTP |
| **Hash-anchored references** | **Konceptualny** | Idea aplikowalna do kontekstu, nie kodu | **Średni** — nowa implementacja |

Kluczowe pliki do analizy w repozytorium OhMyOpenCode: src/hooks/ — implementacje hooków i system rejestracji; src/agents/sisyphus.ts — logika orkiestracyjna; src/mcp/ — integracje Model Context Protocol; src/utils/hashline.ts — hash-anchored edit tool.

#### 2.4.2 Z OpenCode (TypeScript 51.3% + Rust) — selektywny reuse

| Komponent | Poziom reuse | Uzasadnienie | Uwagi |
| --- | --- | --- | --- |
| **Abstrakcja LSP** | **Konceptualny** | Architektura inspirująca, nie bezpośredni kod | LSP dla AI, nie dla kodu |
| **Wzorce multi-session** | **Wysoki** | Session management w packages/ | Adaptacja do subskrypcji |
| **Organizacja monorepo** | **Bezpośredni** | Struktura packages/ sprawdzona | **Kopiować strukturę** |
| **TUI patterns** | **Niski** | Niepotrzebne dla webowego interfejsu | Ignorować |
| **Rust components** | **Analiza** | 0.5% repozytorium, wydajność krytyczna | Rozważyć dla parserów |

Kluczowe katalogi do analizy: packages/core/ — abstrakcje sesji i kontekstu; packages/sdk-\* — wzorce SDK dla różnych języków; infra/ — konfiguracja SST, deployment patterns.

#### 2.4.3 Z LiteLLM — inspiracja architektoniczna, nie kod

LiteLLM, jako projekt w Pythonie, **nie oferuje bezpośredniej reużywalności kodu** dla TypeScriptowego stacku. Jednak jego **architektura proxy stanowi bezcenne źródło inspiracji**:

| Aspekt LiteLLM | Adaptacja dla nowego projektu | Uzasadnienie |
| --- | --- | --- |
| Unified API format | **OpenAI-compatible endpoints** | De facto standard, maksymalna kompatybilność |
| Provider routing | **Subscription-based routing z health checks** | Rozszerzenie o równoległość |
| Rate limiting | **Token-based i request-based limity** | Identyczne wymagania |
| Cost tracking | **Per-request cost attribution** | Rozszerzenie o multi-subscription |
| Fallback logic | **Retry z exponential backoff** | Rozszerzenie o równoległe zapytania |

## 3. Struktura Pliku Konfiguracyjnego dla Architekta

### 3.1 Sekcja: Definicja modułów

#### 3.1.1 Moduł proxy-subscriptions

Moduł stanowiący **serce systemu** — lekki, dedykowany proxy AI inspirowany LiteLLM, ale zoptymalizowany pod orchestrację. Odpowiedzialny za: **inteligentne routing** między subskrypcjami AI z health checkami; **agresywny retry i fallback** przy awariach providerów; **równoległe zapytania** do tego samego modelu z różnych subskrypcji; **zarządzanie kontekstem** z kompresją i hash-anchored invalidation; **system hooków** wymuszający niepodważalne zasady.

#### 3.1.2 Moduł web-orchestrator-interface

**Oddzielny, samodzielny komponent** odpowiedzialny wyłącznie za interfejs użytkownika. Komunikuje się z proxy-subscriptions przez **REST API lub WebSocket**. Nie implementuje logiki proxy — czysta prezentacja i interakcja. Potencjalnie wielokrotne interfejsy (web, CLI, IDE extension) współdzielące ten sam backend proxy.

#### 3.1.3 Moduł shared-types (wspólne typy między modułami)

**Centralne repozytorium typów** Zod schemas, współdzielone przez wszystkie moduły. Zapewnia **kontrakt między proxy a webem**, umożliwia **walidację na granicach** i **generowanie typów dla klientów**. Publikowany jako osobny pakiet w monorepo.

### 3.2 Sekcja: Stack technologiczny z uzasadnieniem

#### 3.2.1 Język i runtime

| Warstwa | Technologia | Uzasadnienie |
| --- | --- | --- |
| Główny język | **TypeScript 5.3+** | Silne typowanie, reużywalność z OhMyOpenCode, AI-assisted dev |
| Runtime | **Node.js 20+ LTS** | Stabilność, ekosystem, znajomość zespołu |
| Alternatywny runtime | **Deno 2+** (rozważyć) | Wbudowany TypeScript, bezpieczne defaults |
| Performance paths | **Bun 1.1+** (opcjonalnie) | Najwyższa wydajność, kompatybilność Node API |
| Krytyczne komponenty | **Rust** (2-5% kodu) | Parsery, transformacje, predictable performance |

#### 3.2.2 Frameworki i biblioteki core

| Kategoria | Wybór | Alternatywa | Decyzja |
| --- | --- | --- | --- |
| Web framework (proxy) | **Hono** | Elysia (jeśli Bun), Fastify | Lekkość, typowanie, wzorzec LiteLLM |
| Walidacja schematów | **Zod** | Valibot (lżejszy), ArkType | Ekosystem, inferencja typów |
| AI providers SDK | **Vercel AI SDK** | Native fetch + wrappery | Szybki start, dobra abstrakcja |
| Równoległość/retry | **p-retry, p-timeout, p-queue** | Effect-TS (złożoność) | 80/20, sprawdzone utility |
| Persystencja (opcjonalnie) | **Drizzle ORM** | Prisma | Typowane SQL, lekkość |

#### 3.2.3 Narzędzia deweloperskie

| Kategoria | Rekomendacja | Uzasadnienie |
| --- | --- | --- |
| Build/bundler | **esbuild** lub **vite** | Szybkość, wsparcie TypeScript |
| Test runner | **Vitest** | Szybki, natywny TypeScript, compatible z Jest |
| Linting | **ESLint + typescript-eslint + Prettier** | Standard, automatyzacja |
| Monorepo | **pnpm workspaces** + **Turborepo** | Sprawdzona w OpenCode, szybkość |
| CI/CD | **GitHub Actions** | Integracja, ekosystem |

### 3.3 Sekcja: Mapowanie funkcji na źródła inspiracji

#### 3.3.1 Co kopiować bezpośrednio z OhMyOpenCode

| Funkcja | Lokalizacja w źródle | Adaptacja wymagana |
| --- | --- | --- |
| System hooków i middleware | src/hooks/ | Rename, integracja z HTTP |
| Abstrakcja workflow/agent | src/agents/sisyphus.ts | Zadania → zapytania AI |
| Integracje MCP | src/mcp/ | Bezpośrednia reużywalność |
| Zarządzanie kontekstem | src/context/ | Adaptacja do token budgeting |
| Hash-anchored references | src/utils/hashline.ts | Z linii kodu → fragmenty kontekstu |

#### 3.3.2 Co adaptować z OpenCode

| Funkcja | Lokalizacja w źródle | Adaptacja wymagana |
| --- | --- | --- |
| Organizacja monorepo | packages/ | Bezpośrednia kopia struktury |
| Abstrakcja sesji | packages/core/src/session/ | Sesje kodu → sesje proxy |
| Multi-session patterns | packages/core/src/multi-session/ | Równoległe subskrypcje |
| LSP-inspired architecture | packages/lsp/ | Protokół dla AI, nie dla kodu |
| Deployment patterns (SST) | infra/ | Adaptacja do własnej infrastruktury |

#### 3.3.3 Co zaimplementować na nowo (LiteLLM-like)

| Funkcja | Uzasadnienie nowej implementacji |
| --- | --- |
| Routing subskrypcji AI | LiteLLM w Pythonie, brak reuse; wymagana równoległość |
| Health checki providerów | Specyficzne dla orchestratora, nie generyczne |
| Token budgeting i cost tracking | Multi-subscription, nie per-provider |
| Format OpenAI-compatible API | Standard, ale własna implementacja typowana |
| WebSocket streaming odpowiedzi | Real-time dla orchestratora, specyficzne wymagania |

### 3.4 Sekcja: Kryteria akceptacji i ograniczenia

#### 3.4.1 Wymagania typowania

| Kryterium | Definicja | Weryfikacja |
| --- | --- | --- |
| **100% TypeScript w kodzie aplikacji** | Zero any, zero nieztypowanych importów | tsc --noImplicitAny --strict |
| **Inferencja typów z Zod schemas** | Wszystkie konfiguracje walidowane i typowane | Testy kompilacji |
| **Typowane granice API** | Request/response types w shared-types | Generowanie klientów |
| **Typowane błędy** | Discriminated unions dla failure modes | Exhaustiveness checking |

#### 3.4.2 Limity zależności

| Kategoria | Limit | Uzasadnienie |
| --- | --- | --- |
| Produkcja runtime dependencies | **< 20** | Lekkość, szybkość audytu, mniejszy attack surface |
| Dev dependencies | **< 50** | Rozsądna złożoność toolchain |
| Native dependencies (napi-rs/WASM) | **< 5** | Uproszczenie buildu, przenośność |
| Alternatywne runtime (Bun/Deno) | **Eksperymentalnie** | Stabilność Node.js priorytetem |

#### 3.4.3 Metryki wydajnościowe

| Metryka | Cel | Pomiar |
| --- | --- | --- |
| Cold start proxy | **< 100ms** | time node dist/index.js |
| Routing decision | **< 1ms** | Benchmark z mockowanymi providerami |
| Retry z fallback | **< 5s total** | Symulacja awarii primary providera |
| Równoległe zapytania (race) | **Pierwsza odpowiedź < 1.5x mediany** | Porównanie z sequential |
| Memory per active session | **< 50MB** | Profilowanie z dużym kontekstem |
| Token overhead proxy | **< 5%** | Porównanie raw vs proxied requests |