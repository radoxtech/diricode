# Analiza projektów OpenCode i oh-my-opencode: Problemy, możliwości i brakujące funkcje
## 1. Kontekst i cel analizy
### 1.1 Zakres badania
#### 1.1.1 Analiza issue GitHub (otwarte, popularne, odrzucone)
Analiza obu projektów opiera się na systematycznym przeglądzie zgłoszeń w repozytoriach GitHub, z uwzględnieniem trzech kluczowych kategorii: otwartych issue oczekujących na implementację, zamkniętych ale odrzuconych propozycji oraz najpopularniejszych problemów według reakcji społeczności. W przypadku OpenCode, repozytorium anomalyco/opencode gromadzi tysiące zgłoszeń, z których wiele dotyczy fundamentalnych problemów architektonicznych. Szczególnie istotne są issue zgłaszające problemy z wydajnością, stabilnością oraz integracją z zewnętrznymi usługami. Z kolei projekt code-yeongyu/oh-my-opencode, będący rozszerzeniem OpenCode, boryka się z odmiennym zestawem problemów, głównie związanych z dokumentacją, nazewnictwem oraz kompatybilnością z bazowym systemem.
Metodologia analizy koncentruje się na identyfikacji wzorców powtarzających się w zgłoszeniach, ocenie priorytetów przypisywanych przez autorów projektów oraz konfrontacji deklarowanych możliwości z rzeczywistymi doświadczeniami użytkowników. Szczególną uwagę zwraca się na issue, które pomimo znaczącego wsparcia społeczności pozostają bez odpowiedzi lub są aktywnie odrzucane przez maintainerów, co często wskazuje na głębsze konflikty między wizją projektową a potrzebami użytkowników.
#### 1.1.2 Identyfikacja największych problemów obu projektów
Największe problemy obu projektów można sklasyfikować w czterech głównych kategoriach: wydajnościowe, stabilnościowe, dokumentacyjne oraz integracyjne. W kategorii wydajnościowej dominuje agresywne wykorzystanie git w OpenCode, prowadzące do degradacji systemu przy dużych repozytoriach. Problem ten został szczegółowo opisany w issue #3176, gdzie użytkownik raportuje katastrofalne skutki próby wykonania git add . na katalogu o rozmiarze 45GB zawierającym 54 000 plików (Github) . Konsekwencje obejmują masowe zużycie zasobów procesora, niestabilność systemu oraz znaczące marnowanie energii elektrycznej. Co istotne, system nie sprawdza rozmiaru katalogu, nie respektuje reguł .gitignore oraz nie oferuje mechanizmu wyłączenia tej funkcjonalności.
Drugi fundamentalny problem dotyczy zarządzania kontekstem konwersacji. W przeciwieństwie do Claude Code, OpenCode wysyła pełną historię wiadomości do API bez żadnej kompresji czy optymalizacji, co prowadzi do szybkiego wyczerpania limitu tokenów (200K w przypadku modeli Claude) oraz degradacji jakości odpowiedzi przy dłuższych sesjach (Github) . Użytkownicy są zmuszeni do ręcznego zakładania nowych konwersacji, tracąc przy tym ciągłość kontekstu.
Projekt oh-my-opencode boryka się z odmiennym, ale równie poważnym zestawem problemów. Centralnym wyzwaniem jest stan dokumentacji i nazewnictwa, który został jednoznacznie określony przez członka społeczności jako “projekt poza kontrolą” (Github) . Użycie nazw mitologicznych (Sisyphus, Hephaestus, Prometheus, Atlas) jako domyślnych identyfikatorów agentów tworzy niepotrzebną barierę wejścia dla nowych użytkowników, podczas gdy brak przejrzystej dokumentacji utrudnia efektywne wykorzystanie zaawansowanych funkcji. Problem ten jest kompaundowany przez brak jasnego rozgraniczenia między funkcjonalnościami istniejącymi a planowanymi, co prowadzi do frustracji i nieporozumień.
#### 1.1.3 Detekcja funkcji odrzucanych przez autorów, ale wartościowych dla społeczności
Analiza odrzuconych propozycji ujawnia istotny wzorzec: autorzy obu projektów systematycznie priorytetyzują szybkość rozwoju i dodawanie nowych funkcji nad stabilność, wydajność i doświadczenie użytkownika. W przypadku OpenCode, propozycja implementacji automatycznej kompresji kontekstu, zgłoszona w styczniu 2026, pozostaje otwarta bez znaczącego postępu mimo jasnych korzyści i gotowego rozwiązania referencyjnego w postaci Claude Code (Github) . Podobnie, żądania umożliwienia konfiguracji lub wyłączenia systemu snapshotów git są konsekwentnie ignorowane, mimo że stanowią rozwiązanie krytycznego problemu wpływającego na użyteczność narzędzia w realnych scenariuszach pracy.
W projekcie oh-my-opencode, odrzucenie propozycji przejrzystego nazewnictwa agentów na rzecz utrzymania mitologicznej konwencji ilustruje konflikt między estetyką twórców a pragmatyzmem użytkowników (Github) . Podobnie, odmowa rozbudowy dokumentacji o strukturyzowaną stronę internetową na rzecz utrzymania rozproszonych plików markdown ogranicza dostępność wiedzy dla szerokiego grona potencjalnych adoptersów. Szczególnie problematyczne jest odrzucenie propozycji umożliwienia wywoływania niestandardowych agentów przez narzędzie call_omo_agent, co bezpośrednio ogranicza ekstensybilność systemu mimo istnienia infrastruktury do ich rejestracji (Github) .
### 1.2 Cel końcowy
#### 1.2.1 Wizja połączonego narzędzia integrującego oba projekty
Wizja połączonego narzędzia zakłada stworzenie kompleksowej platformy do programowania wspomaganego przez sztuczną inteligencję, która łączy stabilność i przewidywalność OpenCode z zaawansowaną orkiestracją i efektywnością oh-my-opencode. Fundamentalną zasadą jest zachowanie kompatybilności wstecznej z istniejącym ekosystemem — w szczególności z Claude Code, który stanowi de facto standard w tej kategorii narzędzi. Połączenie to umożliwiłoby realizację pełnego cyklu rozwoju oprogramowania, od analizy wymagań poprzez implementację, testowanie, review kodu aż po merge, przy minimalnym udziale człowieka w rutynowych operacjach.
Kluczowym elementem wizji jest inteligentny system routing zadań, który automatycznie dobiera optymalny model i strategię wykonania w zależności od charakterystyki problemu. Szybkie, lokalne zmiany mogłyby być realizowane przez lekkie modele z kategorii “quick”, podczas gdy złożone refaktoryzacje architektoniczne wymagałyby zaangażowania głębokich modeli z kategorii “deep” z odpowiednim planowaniem i weryfikacją. System ten musiałby być w pełni transparentny dla użytkownika, oferując jednocześnie możliwość ręcznej interwencji i nadpisania decyzji.
#### 1.2.2 Mapa obecnych możliwości (mind map)
Mapa obecnych możliwości ma na celu wizualizację pełnego spektrum funkcjonalności dostępnych w obu projektach, zorganizowanych w logiczne kategorie odpowiadające głównym obszarom zastosowań. Struktura ta umożliwia szybką identyfikację mocnych stron każdego z projektów oraz obszarów, gdzie ich połączenie tworzy szczególną wartość dodaną.
#### 1.2.3 Mapa najbardziej brakujących elementów (mind map)
Druga mapa koncentruje się na identyfikacji luk funkcjonalnych, które uniemożliwiają pełne wykorzystanie potencjału obu projektów oraz na propozycjach rozwiązań mogących przekształcić połączone narzędzie w kompletną platformę. Elementy te zostały wyselekcjonowane na podstawie analizy zgłoszeń użytkowników, oceny wpływu na doświadczenie użytkownika oraz oceny technicznej wykonalności implementacji.

## 2. OpenCode – fundament i jego krytyczne problemy
### 2.1 Architektura i podstawowe możliwości
#### 2.1.1 Silnik agentów AI z wieloma modelami (Claude, GPT, Gemini, Kimi, GLM)
OpenCode implementuje abstrakcję warstwy modelowej, która teoretycznie umożliwia integrację z dowolnym dostawcą modeli językowych obsługującym standardowy interfejs API. W praktyce, najbardziej rozwinięte wsparcie dotyczy modeli Anthropic (Claude), co wynika zarówno z historycznych korzeni projektu, jak i preferencji pierwotnych twórców. Architektura ta opiera się na dynamicznym systemie routing zapytań, gdzie wybór modelu może być dokonywany na poziomie konfiguracji globalnej, per-sesji lub nawet per-zapytania poprzez odpowiednie dyrektywy.
Integracja z modelami OpenAI (GPT), Google (Gemini) oraz chińskimi dostawcami (Kimi, GLM) jest funkcjonalna, ale często okazuje się mniej stabilna i mniej wydajna niż ścieżka Claude. Szczególnie problematyczne są różnice w obsłudze narzędzi (function calling), gdzie modele różnią się znacząco w formacie i niezawodności odpowiedzi strukturyzowanych. OpenCode implementuje warstwę normalizacji, która ma za zadanie ujednolicić te różnice, ale jej kompletność i jakość są zmienne w zależności od modelu.
Warto zauważyć, że oh-my-opencode rozszerza tę architekturę o koncepcję kategorii zadań, gdzie każda kategoria jest automatycznie mapowana na optymalny model bez konieczności ręcznej konfiguracji przez użytkownika. To podejście, opisane jako “Agent says what kind of work. Harness picks the right model. You touch nothing” (Github) , reprezentuje znaczące usprawnienie w stosunku do manualnego zarządzania modelami, ale wymaga utrzymania aktualnej bazy wiedzy o charakterystykach poszczególnych modeli.
#### 2.1.2 Integracja GitHub (triage, fix, implementacja, PR review)
Integracja z GitHub stanowi jedną z najmocniejszych stron OpenCode, oferując kompleksowe wsparcie dla całego cyklu życia zgłoszenia. System obsługuje sześć typów zdarzeń triggerujących: issue_comment, pull_request_review_comment, issues, pull_request, schedule oraz workflow_dispatch (opencode.ai) . Ta elastyczność umożliwia implementację zaawansowanych workflow automatyzacji, od prostego triage’owania zgłoszeń po pełną autonomiczną implementację funkcjonalności z własnym review kodu.
Mechanizm wyzwalania oparty na wzmiankach /opencode lub /oc w komentarzach jest intuicyjny i dobrze zintegrowany z natywnym interfejsem GitHub. Po wyzwoleniu, OpenCode otrzymuje pełny kontekst zdarzenia, w tym dla komentarzy do PR również ścieżkę pliku, numery linii oraz kontekst diff, co umożliwia precyzyjne, lokalizowane operacje bez konieczności manualnego specyfikowania lokalizacji przez użytkownika (opencode.ai) .
Funkcjonalność automatycznego tworzenia gałęzi i submitowania pull requestów jest szczególnie wartościowa w scenariuszach, gdzie zgłoszenie issue zawiera wystarczająco szczegółowy opis oczekiwanego zachowania. System potrafi przeanalizować treść issue, zaproponować implementację, wykonać niezbędne zmiany w kodzie, przetestować je (o ile skonfigurowano odpowiednie narzędzia CI) oraz otworzyć PR z kompletnym opisem zmian. Ta funkcjonalność, choć imponująca, wymaga starannej konfiguracji uprawnień i sekretów, a także odpowiedzialnego podejścia do ograniczeń autonomii agenta.
#### 2.1.3 LSP (Language Server Protocol) dla precyzji IDE
Integracja LSP stanowi kluczowy element architektury OpenCode, który odróżnia je od prostych chatbotów kodowych. Poprzez komunikację z serwerami LSP poprzez standardowy protokół STDIO, OpenCode uzyskuje dostęp do semantycznej analizy kodu na poziomie porównywalnym z nowoczesnymi IDE. Implementacja wykorzystuje magistralę zdarzeń (event bus) oraz globalną mapę diagnostyk, co umożliwia asynchroniczne, nieblokujące przetwarzanie informacji z serwerów językowych (cefboud.com) .
Konkretne operacje LSP dostępne w OpenCode obejmują: lsp_rename dla bezpiecznej zmiany nazw symboli, lsp_goto_definition dla nawigacji do definicji, lsp_find_references dla identyfikacji wszystkich użyc danego symbolu oraz lsp_diagnostics dla pobierania błędów i ostrzeżeń kompilacji. Ta precyzja jest szczególnie krytyczna w operacjach refaktoryzacyjnych, gdzie proste operacje tekstowe mogłyby prowadzić do niekonsystencji semantycznej.
Warto podkreślić, że oh-my-opencode rozszerza tę funkcjonalność o integrację z AST-Grep, narzędziem do wyszukiwania i przekształcania kodu opartego na abstrakcyjnych drzewach składniowych. Kombinacja LSP i AST-Grep oferuje zarówno precyzję semantyczną (LSP) jak i elastyczność wzorcową (AST-Grep) dla 25+ języków programowania (Github) , co stanowi kompleksowe rozwiązanie dla analizy i modyfikacji kodu.
#### 2.1.4 TUI (Terminal User Interface) z real-time SSE events
Interfejs terminalowy OpenCode został zaprojektowany jako klient HTTP do lokalnego serwera, co umożliwia architekturę rozproszoną i wieloklientową. Serwer OpenCode eksponuje endpoint /sse (Server-Sent Events), który strumieniuje wszystkie zdarzenia aplikacji w czasie rzeczywistym (cefboud.com) . Ta architektura ma kilka istotnych konsekwencji: po pierwsze, umożliwia podłączenie wielu klientów równocześnie (np. TUI, aplikacja mobilna, inne narzędzia); po drugie, ułatwia debugowanie i monitorowanie poprzez proste subskrypcje HTTP; po trzecie, tworzy naturalny punkt rozszerzalności dla integracji zewnętrznych.
Protokół SSE został wybrany zamiast WebSocket ze względu na prostotę implementacji i lepszą kompatybilność z infrastrukturą proxy i firewall. Każdy fragment wiadomości (text, tool call, tool result, error) jest serializowany jako osobne zdarzenie SSE, co umożliwia granularną aktualizację interfejsu użytkownika bez konieczności pełnego odświeżania. Mechanizm updatePart odpowiada za persystencję wyników na dysk, podczas gdy magistrala zdarzeń zapewnia ich dystrybucję do wszystkich zainteresowanych komponentów (cefboud.com) .
#### 2.1.5 System snapshotów git dla zarządzania sesjami
System snapshotów git został zaprojektowany jako mechanizm bezpieczeństwa, umożliwiający przywrócenie stanu roboczego w przypadku niepowodzenia operacji agenta. Implementacja wykorzystuje niskopoziomowe komendy git (git write-tree, git read-tree, git checkout-index) do tworzenia tymczasowych, niepowiązanych commitów, które nie zanieczyszczają historii repozytorium (cefboud.com) . Funkcja track() tworzy snapshot poprzez dodanie wszystkich plików do indeksu i zapis drzewa, podczas gdy restore() przywraca stan poprzez odczyt drzewa i wymuszone checkout.
Z teoretycznego punktu widzenia, ten mechanizm oferuje eleganckie rozwiązanie problemu atomowości operacji agenta — jeśli coś pójdzie nie tak, można powrócić do znanego dobrego stanu. Jednakże, jak szczegółowo omówiono w sekcji 2.2, implementacja ta zawiera fundamentalne błędy projektowe, które czynią ją problematyczną lub wręcz nieużywalną w wielu realnych scenariuszach.
### 2.2 Fundamentalny problem projektowy: nadużycie git
#### 2.2.1 Brak sprawdzania rozmiaru katalogu przed git add .
Problem został zidentyfikowany i szczegółowo udokumentowany w issue #3176, którego autor dostarcza jasnej diagnozy: “OpenCode shouldn’t be doing git add . on a 45GB directory with 54K files — that’s insane behavior” (Github) . Analiza kodu źródłowego potwierdza, że funkcja track() wywołuje $git –git-dir ${git} add .`` bez żadnej wstępnej walidacji rozmiaru czy struktury katalogu (cefboud.com) . Ta operacja, wykonywana w głównym wątku, blokuje całą aplikację do momentu zakończenia indeksowania.
W kontekście współczesnych projektów programistycznych, gdzie monorepo zawierające miliony plików nie są rzadkością, a katalogi node_modules czy vendor mogą zawierać setki tysięcy zależności, ta implementacja jest nieakceptowalna. Szczególnie problematyczne są projekty data science, gdzie katalogi z datasetami i modelami ML rutynowo osiągają rozmiary dziesiątek gigabajtów (Github) . Brak jakiejkolwiek heurystyki wstępnej — nawet prostej weryfikacji liczby plików w katalogu głównym — wskazuje na brak testowania w realnych warunkach produkcyjnych.
#### 2.2.2 Ignorowanie liczby plików (przypadki 54K+ plików, 45GB+ danych)
Skala problemu jest ilustrowana przez konkretne przypadki raportowane przez użytkowników. Konfiguracja z 54 000 plików i 45 GB danych, choć ekstremalna, nie jest niemożliwa w kontekście projektów z dużymi zasobami multimedialnymi, historycznymi danymi treningowymi lub rozległymi zależnościami. Kluczowym aspektem jest to, że system nie dyskryminuje między plikami kodu źródłowego (które zazwyczaj są małe i liczne) a plikami danych (które mogą być pojedynczo duże) (Github) .
Mechanizm git add . jest szczególnie nieefektywny dla dużych plików binarnych, które nie podlegają delty-kompresji i muszą być skopiowane w całości do obiektu git. W przypadku plików o rozmiarze setek megabajtów, pojedyncza operacja może trwać minuty i generować gigabajty I/O dyskowego. Gdy operacja ta jest wykonywana wielokrotnie w trakcie sesji (co jest typowe przy aktywnym użytkowaniu agenta), kumulatywny wpływ na wydajność staje się katastrofalny.
#### 2.2.3 Nieposzanowanie reguł .gitignore
Jednym z najbardziej zaskakujących aspektów implementacji jest całkowite ignorowanie reguł .gitignore. W standardowym użyciu git, git add . respektuje te reguły i nie dodaje dopasowanych plików do indeksu. Jednakże, w kontekście snapshotów OpenCode, zachowanie to jest niepożądane — użytkownik oczekuje, że snapshot odzwierciedla dokładny stan roboczy, włącznie z plikami tymczasowymi i wygenerowanymi, które normalnie są ignorowane w commitach.
Ta niejasność semantyczna prowadzi do nieprzewidywalnego zachowania. Z jednej strony, użytkownik może oczekiwać, że snapshot zawiera wszystko (w końcu to “stan roboczy”); z drugiej, niekontrolowane dodawanie gigabajtów plików tymczasowych jest oczywiście problematyczne. Brak konfiguracji pozwalającej na sprecyzowanie oczekiwanego zachowania — lub przynajmniej wykluczenie określonych wzorców — jest poważnym niedopatrzeniem projektowym (Github) .
#### 2.2.4 Konsekwencje: degradacja wydajności, niestabilność systemu, marnowanie zasobów
Konsekwencje opisane przez użytkowników są wielowymiarowe i dotykają wszystkich aspektów doświadczenia użytkownika. Degradacja wydajności objawia się jako “massive slowdowns” — aplikacja staje się nieodpowiadająca, operacje trwają nieproporcjonalnie długo, a interfejs użytkownika zamarza. Niestabilność systemu wynika z ekstremalnego zużycia zasobów: “CPU usage going through the roof, system becoming unstable” (Github) . W skrajnych przypadkach, system operacyjny może zacząć odrzucać alokacje pamięci lub zabijać procesy, co prowadzi do utraty danych i frustracji.
Aspekt “insane energy waste” jest szczególnie istotny w kontekście współczesnych procesorów wielordzeniowych, które przy pełnym obciążeniu mogą zużywać setki watów energii. Użytkownik raportujący problem posiada procesor Threadripper, który w scenariuszach obciążenia może pobierać ponad 250W — marnowanie tej energii na niepotrzebne operacje I/O jest zarówno ekonomicznie, jak i ekologicznie nieuzasadnione. Dodatkowo, intensywne operacje dyskowe przyspieszają zużycie nośników SSD, szczególnie tych opartych na pamięci QLC.
#### 2.2.5 Brak konfiguracji wyłączenia lub ograniczenia snapshotów
Najbardziej frustrujący aspekt problemu to całkowity brak możliwości konfiguracji. Użytkownik nie może wyłączyć snapshotów, nie może ustawić limitów rozmiaru, nie może zdefiniować wykluczeń, nie może nawet wybrać alternatywnej strategii (np. snapshotowania tylko określonych ścieżek). Ta “brak konfiguracji, brak pozwolenia, brak logiki” (Github) reprezentuje podejście projektowe, które ignoruje zróżnicowane potrzeby użytkowników i zakłada jeden, uniwersalny scenariusz użycia.
Propozycje rozwiązania obejmują: dodanie konfiguracji snapshot.enabled (boolean), snapshot.maxSize (w bajtach lub liczbie plików), snapshot.excludePatterns (tablica globów), oraz snapshot.respectGitignore (boolean z domyślną wartością false dla backward compatibility). Implementacja tych opcji byłaby stosunkowo prosta i nie wpłynęłaby negatywnie na istniejących użytkowników, podczas gdy znacząco poprawiłaby doświadczenie zaawansowanych użytkowników. Odmowa implementacji tych funkcji przez autorów, mimo jasnej wartości dla społeczności, jest jednym z kluczowych przykładów priorytetyzacji własnej wizji nad feedbackiem użytkowników.
### 2.3 Problemy wydajnościowe i stabilności
#### 2.3.1 Brak auto-kompresji kontekstu (vs. Claude Code)
Problem został zgłoszony w issue #9637 z stycznia 2026 i pozostaje otwarty bez znaczącego postępu (Github) . Autor zgłoszenia szczegółowo opisuje różnicę w zachowaniu między OpenCode a Claude Code: podczas gdy Claude Code automatycznie zarządza kontekstem poprzez kompresję i podsumowywanie starszych wiadomości, OpenCode wysyła pełną historię konwersacji do API, prowadząc do szybkiego wyczerpania dostępnego limitu tokenów.
Propozycja rozwiązania obejmuje trzy komponenty: sliding window zachowujący pełną treść ostatnich N wiadomości (np. 20) z podsumowaniem starszych; automatyczną sumaryzację wyzwalaną przy przekroczeniu progu (np. 70% limitu kontekstu); oraz komendy użytkownika /compact do ręcznego wyzwalania kompresji i /context do wyświetlania bieżącego zużycia tokenów (Github) . Te rozwiązania są dobrze znane w literaturze i zaimplementowane w wielu konkurencyjnych narzędziach, co czyni ich brak w OpenCode szczególnie zauważalnym.
Konsekwencje braku tej funkcji są poważne: użytkownicy są zmuszeni do ręcznego zarządzania sesjami, co przerywa flow pracy i prowadzi do utraty kontekstu; jakość odpowiedzi degraduje się wraz z wypełnianiem kontekstu, ponieważ model ma mniej “uwagi” do dyspozycji dla bieżącego zapytania; koszty API rosną nieproporcjonalnie, ponieważ duża część tokenów jest zużywana na powtarzanie historycznych informacji zamiast na generowanie nowej wartości.
#### 2.3.2 Pełna historia konwersacji wysyłana do API bez optymalizacji
Bezpośrednim skutkiem braku kompresji jest liniowy wzrost kosztów i czasu odpowiedzi wraz z długością sesji. Każda wiadomość w historii jest serializowana i dołączana do promptu, bez żadnej deduplikacji, agregacji czy priorytetyzacji. W praktyce oznacza to, że długa sesja programistyczna, zawierająca wiele iteracji, błędów i ich napraw, może osiągnąć limit kontekstu (200K tokenów dla Claude 3.5 Sonnet) w ciągu godziny aktywnej pracy.
Szczególnie problematyczne są sesje zawierające duże wstawki kodu — każda operacja read czy edit dołącza pełną zawartość pliku do historii, a nawet niewielka zmiana w dużym pliku powoduje powielenie jego treści. W scenariuszu intensywnej refaktoryzacji, gdzie ten sam plik jest modyfikowany wielokrotnie, kontekst może zostać zdominowany przez powtarzające się, lekko różniące się wersje tego samego kodu. Inteligentny system kompresji mógłby zastąpić te powtórzenia referencjami lub diffami, zachowując semantyczną istotność przy ułamku oryginalnego rozmiaru.
#### 2.3.3 Problemy z rate limitowaniem GitHub API
Integracja GitHub, choć funkcjonalnie bogata, naraża użytkowników na ograniczenia rate limitów API GitHub. Dla nieuwierzytelnionych żądań, limit wynosi zaledwie 60 żądań na godzinę, podczas gdy uwierzytelnione żądania zwiększają ten limit do 5000 żądań na godzinę (steffenstein.com) . W praktyce, aktywne użycie OpenCode w projekcie z dużą liczbą issue i PR może szybko wyczerpać nawet wyższy limit, szczególnie gdy agent wykonuje operacje takie jak enumeracja wszystkich otwartych issue czy pobieranie szczegółowych informacji o wielu PR.
Rozwiązania obejmują implementację logiki retry z wykładniczym backoff, agresywne cache’owanie odpowiedzi, oraz — najbardziej fundamentalnie — redukcję liczby niezbędnych żądań poprzez batching i selektywne pobieranie danych. Obecna implementacja nie wydaje się stosować tych optymalizacji w stopniu wystarczającym, co prowadzi do częstych błędów “Rate limiting exceeded” i przerywania workflow (steffenstein.com) .
#### 2.3.4 Crashe terminala przy Ctrl+C
Issue #3691 raportuje niezwykły i niepokojący problem: naciśnięcie Ctrl+C w celu przerwania OpenCode powoduje nie tylko zamknięcie aplikacji, ale również zamknięcie całej karty terminala (Github) . Problem występuje na Windows 11 w wielu terminalach (Wezterm, Rio, Alacritty, Tabby, Windows Terminal), co sugeruje błąd w obsłudze sygnałów na poziomie runtime lub interakcji z shellem.
Zachowanie to jest szczególnie problematyczne, ponieważ Ctrl+C jest standardowym sposobem anulowania operacji w terminalu, a jego użycie nie powinno mieć efektów ubocznych poza przerwaniem bieżącego procesu. Możliwe przyczyny obejmują: nieprawidłową obsługę sygnału SIGINT, który jest propagowany do procesu nadrzędnego (shella); użycie exec lub podobnego mechanizmu, który zastępuje proces shella procesem OpenCode; lub błąd w kodzie obsługi wyjątków, który w niekontrolowany sposób zamyka całą grupę procesów.
#### 2.3.5 Problemy z pamięcią i wycieki (memory leaks)
Wiele zgłoszeń wskazuje na problemy z zarządzaniem pamięcią, szczególnie w długotrwałych sesjach. Choć szczegółowe dane diagnostyczne są trudno dostępne bez profilowania, symptomy obejmują: stopniowe spowolnienie aplikacji w czasie; wzrost zużycia pamięci procesu OpenCode nieproporcjonalny do aktywności; oraz eventualne zawieszenia lub crashe przy przekroczeniu limitów pamięci systemowej. Te problemy są kompaundowane przez wcześniej wspomniany brak kompresji kontekstu, który powoduje, że pamięć zajmowana przez historię konwersacji rośnie nieograniczenie.
### 2.4 Problemy integracyjne i zgodności
#### 2.4.1 Blokada kont Anthropic przy użyciu OAuth zamiast API keys
Issue #6930 dokumentuje poważny problem zgodności z warunkami usług Anthropic: użycie OpenCode z autentykacją OAuth (zamiast bezpośredniego klucza API) prowadzi do permanentnej blokady konta użytkownika (Github) . Autor zgłoszenia, po kontakcie z inżynierami Anthropic, potwierdził, że “using Claude in this way on Open Code violates their terms of service and results in a ban”. Konsekwencją jest utrata dostępu do subskrypcji Claude Max oraz — potencjalnie — wszystkich danych powiązanych z kontem.
Problem jest szczególnie niebezpieczny, ponieważ OpenCode aktywnie promuje autentykację OAuth jako wygodną alternatywę dla ręcznego zarządzania kluczami API. Użytkownik, który podąży za tą sugestią, może nieświadomie naruszyć warunki usług i stracić dostęp do usługi, której płaci. Rekomendacja zgłoszenia — “Open Code should no longer allow users to log in to any of the OAuth subscriptions because this violates all their terms of service” — pozostaje bez odpowiedzi, co sugeruje, że autorzy priorytetyzują wygodę onboarding nad bezpieczeństwo użytkowników.
#### 2.4.2 Problemy z GitHub Actions przy wyłączonych domyślnych agentach
Issue #4578 ujawnia subtelny, ale istotny problem w integracji GitHub Actions: możliwość wyłączenia domyślnych agentów (plan, build) w konfiguracji, która jest używana lokalnie, powoduje błąd w środowisku GitHub Actions (Github) . Błąd “undefined is not an object (evaluating ‘agent.name’)” wskazuje na nieprawidłową obsługę sytuacji, gdy oczekiwany agent nie istnieje w konfiguracji.
Ten problem ilustruje szerszy wzorzec: konfiguracja OpenCode jest projektowana przede wszystkim z myślą o lokalnym użyciu interaktywnym, a scenariusze CI/CD są traktowane jako drugorzędne. Użytkownik, który chce używać niestandardowych agentów lokalnie, jest zmuszony do żmudnego przełączania konfiguracji przy każdej zmianie kontekstu pracy, co jest zarówno nieefektywne, jak i podatne na błędy.
#### 2.4.3 Brak wskazania agenta w CLI dla workflow GitHub
Bezpośrednio związany z powyższym, brak możliwości specyfikacji agenta w linii komend (opencode --agent [name] <prompt>) uniemożliwia elastyczne zarządzanie agentami w środowiskach zautomatyzowanych (Github) . W workflow GitHub Actions, gdzie nie ma interaktywnego użytkownika do wyboru agenta, system musi polegać na domyślnej konfiguracji, co jest sprzeczne z celem używania niestandardowych agentów dla specyficznych zadań.
Propozycja rozwiązania — dodanie flagi --agent do CLI oraz odpowiedniego parametru w konfiguracji GitHub Actions — jest technicznie prosta i nie wprowadzałaby breaking changes, ale pozostaje niezaimplementowana.

## 3. oh-my-opencode – rozszerzenie i jego chaos
oh-my-opencode, stworzony przez Yeongyu Kima (code-yeongyu), reprezentuje ambicję społecznościową do stworzenia “najlepszego harnessu dla agentów” poprzez rozszerzenie OpenCode o zaawansowane możliwości planowania, delegowania i wykonywania zadań. Projekt zyskał znaczną popularność (~32,700 gwiazdek), ale cierpi na fundamentalne problemy zarządzania i stabilności.
### 3.1 Architektura i deklarowane możliwości
#### 3.1.1 System Discipline Agents (Sisyphus, Hephaestus, Prometheus, Atlas)
System Discipline Agents stanowi rdzeń filozofii oh-my-opencode. Zamiast pojedynczego, wszechstronnego agenta, system definiuje specjalizowane role, każda z określonym zakresem odpowiedzialności i modelem optymalnym dla danego typu zadania:
Ta architektura pozwala na równoległe wykonywanie zadań — np. gdy Atlas wykonuje bieżący plan, Prometheus może już przygotowywać następny, a Hephaestus przeprowadza głęboką analizę kodu w tle (Github) .
#### 3.1.2 Agent Orchestration z kategoriami (visual-engineering, deep, quick, ultrabrain)
oh-my-opencode implementuje kategoryzację agentów pozwalającą na szybki wybór strategii bez manualnego zarządzania modelami:
System ten automatycznie mapuje kategorię na optymalny model, eliminując konieczność ręcznego przełączania przez użytkownika (Github) .
#### 3.1.3 Claude Code Compatibility (pełna kompatybilność hooków, komend, skilli, MCP)
Jednym z kluczowych deklarowanych atutów jest pełna kompatybilność z ekosystemem Claude Code — hooki, komendy, skille, serwery MCP i pluginy mają działać bez modyfikacji. Użytkownicy, którzy spędzili godziny na konfiguracji Claude Code, mogą teoretycznie przenieść całą swoją konfigurację do oh-my-opencode bez zmian. W praktyce jednak ta kompatybilność jest częściowa — zgłoszenie #1560 dokumentuje konflikty między planning-with-files skill a oh-my-opencode, gdzie agent ignoruje reguły zdefiniowane w skillu (Github) .
#### 3.1.4 Hash-Anchored Edit Tool (Hashline) dla stabilnych edycji
Hashline stanowi innowacyjne rozwiązanie problemu “harness problem” opisanego przez Cana Bölüka. Zamiast polegać na reprodukowaniu treści przez model (co często kończy się błędami przy zmianach wcięć lub formatowania), Hashline taguje każdą odczytaną linię hashem zawartości:
11#VK: function hello() {
22#XJ:   return "world";
33#MB: }
Agent edytuje, odwołując się do tych tagów. Jeśli plik zmienił się od ostatniego odczytu, hash nie będzie pasował i edycja zostanie odrzucona przed wprowadzeniem korupcji. Według danych oh-my-opencode, ta zmiana podniosła wskaźnik sukcesu edycji z 6.7% do 68.3% w benchmarku Grok Code Fast 1 (Github) .
#### 3.1.5 LSP + AST-Grep + Tmux + MCP zintegrowane
oh-my-opencode bundluje szereg narzędzi w spójny stos:
LSP: Pełna integracja z language servers dla refaktoryzacji i diagnostyki
AST-Grep: Pattern matching dla 25+ języków (Github)
Tmux: Interaktywne terminale dla REPL i debuggerów
MCP: Model Context Protocol serwery (Context7, grep.app, web search)
#### 3.1.6 Background Agents i parallel execution
System Background Agents pozwala na uruchamianie agentów w tle, z notyfikacjami o zakończeniu. W połączeniu z Ultrawork mode (równoległe wykonywanie), ma to umożliwiać prawdziwie równoległą pracę wielu agentów (Github) .
#### 3.1.7 Skill-Embedded MCPs (on-demand, scoped do tasku)
oh-my-opencode wprowadza koncept Skill-Embedded MCPs — serwerów MCP ładowanych na żądanie, scoped do konkretnego zadania, co ma zapewniać czyste context window bez permanentnego narzutu (Github) .
### 3.2 Krytyczny problem: dokumentacja i nazewnictwo
Pomimo imponujących deklaracji technicznych, oh-my-opencode cierpi na kryzys dokumentacyjny, który skutecznie barieruje wejście dla nowych użytkowników.
#### 3.2.1 “Projekt poza kontrolą” – brak przejrzystej dokumentacji
Issue #1995 z lutego 2026 stanowi bezprecedensową krytykę ze strony zaangażowanego członka społeczności. Tytuł: “[Feature]: Brand new oh-my-opencode” — sugeruje fundamentalną restrukturyzację (Github) . Autor wymienia konkretne braki: (1) brak proper documentation website, (2) niejasne nazewnictwo agentów, (3) brak documented features (co istnieje vs. co jest w drodze), (4) brak skills guide, (5) brak installation guide, (6) brak dokumentacji hooks, state management, i advanced topics.
#### 3.2.2 Nazwy mitologiczne (Sisyphus, Hephaestus, Prometheus) jako bariera wejścia
Mitologiczne nazwy, choć eleganckie i spójne tematycznie, nie komunikują funkcji agentów. Nowy użytkownik musi zapamiętać, że “Sisyphus to ultraworker”, “Hephaestus to deep agent” itd. — dodatkowa warstwa poznawcza, która nie przynosi wartości funkcjonalnej. Sugestia zgłoszenia: “Ludzie mogą nazywać agentów według własnego gustu, ale domyślne muszą być sensowne dla wszystkich” (Github) .
Autor odrzuca te propozycje, utrzymując mitologiczne nazewnictwo jako element “filozofii projektu” (Github) .
#### 3.2.3 Brak skills guide, installation guide, dokumentacji hooks i state management
Struktura dokumentacji jest rozproszona między: głównym README (przestarzałe informacje), website ohmyopencode.com (niekompletne), inline comments w kodzie (nieczytelne dla użytkowników końcowych), oraz Discord community (nieindeksowalne). Brakuje kluczowych elementów: kompletnego skills guide opisującego jak tworzyć i używać skilli, installation guide dla różnych platform (szczególnie Windows), oraz dokumentacji state management i hooks lifecycle.
#### 3.2.4 Brak jasnego opisu co istnieje, a co jest w drodze
oh-my-opencode miesza funkcje zaimplementowane, eksperymentalne i planowane bez jasnego oznaczenia. Przykładowo, preemptive-compaction hook jest obecny w kodzie jako null (wyłączony), ale dokumentacja sugeruje jego dostępność (Github) .
### 3.3 Problemy stabilności i integracji z OpenCode
Najpoważniejsze problemy oh-my-opencode dotyczą integracji z OpenCode — paradoksalnie, biorąc pod uwagę że oh-my-opencode jest deklarowany jako “plugin dla OpenCode”.
#### 3.3.1 Crashe przy starcie OpenCode po instalacji oh-my-opencode
Issue #1142 dokumentuje krytyczny crash przy starcie: “opencode crashed after oh-my-opencode installed” — częsty wzorzec, gdzie instalacja pluginu powoduje niestartowanie głównej aplikacji (Source) . Issue #986 dokumentuje dodatkowo: “desktop nie otwiera się, cli działa na czarnym ekranie” po aktualizacji OpenCode przy starej wersji oh-my-opencode (Github) .
#### 3.3.2 Problem z Bun runtime i wymaganiem AVX2/AVX-512
oh-my-opencode preferuje Bun jako runtime, ale Bun wymaga współczesnych instrukcji CPU (AVX2/AVX-512), co wyklucza starsze maszyny i niektóre środowiska wirtualne. Issue #1142 identyfikuje ten problem jako główną przyczynę crashy na niekompatybilnych procesorach (Source) .
#### 3.3.3 Błąd inicjalizacji agentów (agents()[0].name undefined)
Częsty błąd występujący przy niestandardowych konfiguracjach, gdzie oczekiwana struktura agentów nie jest zgodna z rzeczywistą. Szczegółowa analiza w issue #1972 wskazuje na race condition w inicjalizacji: oh-my-opencode nie gwarantuje, że agenty są w pełni załadowane przed tym, jak OpenCode próbuje renderować UI (Github) .
#### 3.3.4 Brak narzędzia opencode question tool w oh-my-opencode
oh-my-opencode nie implementuje pełnego zestawu narzędzi OpenCode, w szczególności brakuje opencode question tool, co ogranicza możliwości interaktywnego zadawania pytań użytkownikowi (Source) .
#### 3.3.5 Severe Memory Leak przy współpracy z OpenCode
Zgłoszenia #1559 i #1972 sugerują kumulatywne problemy z pamięcią przy długotrwałej współpracy, prawdopodobnie związane z nieprawidłowym czyszczeniem hooków i subskrypcji eventów (Github) .
### 3.4 Problemy konfiguracyjne
#### 3.4.1 Ciche odrzucanie całej konfiguracji przy jednym nieprawidłowym polu
oh-my-opencode implementuje all-or-nothing validation — jedno nieprawidłowe pole w oh-my-opencode.json powoduje ciche odrzucenie całej konfiguracji, bez wskazania które pole jest problematyczne (Github) .
#### 3.4.2 Niespójność schematu uprawnień (edit vs bash)
Schemat uprawnień jest niespójny z OpenCode — np. edit i bash mają różne domyślne wartości i semantykę, co prowadzi do confusion przy konfiguracji restrykcyjnych polityk.
#### 3.4.3 Hardcoded ALLOWED_AGENTS whitelist blokujący custom agents
Lista ALLOWED_AGENTS jest zakodowana na stałe, uniemożliwiając użytkownikom dodawanie własnych agentów bez modyfikacji kodu źródłowego (Github) .

## 4. Funkcje odrzucane przez autorów, ale wartościowe dla społeczności
### 4.1 OpenCode – odrzucone lub ignorowane
#### 4.1.1 Auto Context Compression (jak w Claude Code) – otwarte od stycznia 2026
Issue #9637 pozostaje otwarte od 20 stycznia 2026, z 355 reakcjami 👍 i aktywną dyskusją, ale bez znaczącego postępu implementacyjnego (Github) . Funkcja jest uznawana przez społeczność za “oczywistą” dla narzędzia agentowego, ale autorzy nie priorytetyzują jej implementacji. Możliwe przyczyny: trudność techniczna (wymaga integracji z modelami summarization), konflikt z wizją “pełnej historii” jako cechy produktu, lub ograniczone zasoby deweloperskie.
#### 4.1.2 Konfigurowalne limity snapshotów git lub ich wyłączenie
Mimo dramatycznych zgłoszeń w #3176, autorzy nie wdrożyli żadnej z proponowanych opcji: snapshot.enabled, snapshot.maxSize, snapshot.excludePatterns, snapshot.respectGitignore (Github) . Sugeruje to, że snapshoty są traktowane jako nienegocjowalna cecha architektoniczna.
#### 4.1.3 Partial config loading zamiast all-or-nothing rejection
Społeczność preferuje graceful degradation — zaakceptowanie poprawnej części konfiguracji z ostrzeżeniem o błędnych polach — zamiast całkowitego odrzucenia. Ta zmiana byłaby szczególnie wartościowa w kontekście częstych zmian w schemacie konfiguracji.
#### 4.1.4 Lepsze zarządzanie rate limitami GitHub API
Użytkownicy enterprise potrzebują przewidywalności w integracjach CI/CD. Obecne agresywne rate limitowanie bez efektywnego backoff utrudnia adopcję w środowiskach produkcyjnych (steffenstein.com) .
### 4.2 oh-my-opencode – odrzucone lub ignorowane
#### 4.2.1 Przejrzyste, opisowe nazwy agentów zamiast mitologicznych
Zgłoszenie #1995 jest jasnym głosem społeczności za zmianą nazewnictwa, ale odpowiedź autora sugeruje, że mitologiczne nazwy są częścią tożsamości projektu (Github) . To tworzy fundamentalny konflikt: czy projekt ma być narzędziem dla mas (z opisowymi nazwami), czy produktem niszowym z silną tożsamością kulturową?
#### 4.2.2 Pełna dokumentacja website zamiast rozproszonych plików
Propozycja “proper documentation website” w #1995 (Github) pozostaje niezaimplementowana. Obecna dokumentacja, rozproszona między README, AGENTS.md, i różnymi plikami markdown, jest trudna do nawigacji i aktualizacji.
#### 4.2.3 Wsparcie dla custom agents w call_omo_agent
Hardcoded whitelist agentów jest świadomym wyborem architektonicznym, ale ogranicza elastyczność dla zaawansowanych użytkowników. Społeczność prosi o konfigurowalność, ale autorzy utrzymują obecną implementację (Github) .
#### 4.2.4 Konsolidacja konfiguracji i lepsza walidacja błędów
Zgłoszenie #1744 “oh-my-opencode should NOT write to its config file” (Github) ilustruje problem z zarządzaniem stanem — użytkownicy chcą wersjonować konfigurację, ale oh-my-opencode traktuje plik konfiguracyjny jako mutable state.

## 5. Wizja połączonego narzędzia: możliwości synergiczne
### 5.1 Rdzeń: OpenCode jako platforma wykonawcza
#### 5.1.1 Stabilny silnik agentów z multi-model support
OpenCode zapewnia sprawdzoną abstrakcję dla wielu dostawców modeli, która — po usunięciu problemów z autentykacją OAuth — stanowi solidną podstawę. Kluczowe jest zachowanie tej elastyczności przy dodaniu lepszej obsługi błędów i fallback’ów.
#### 5.1.2 GitHub-native workflow (issue → branch → PR → review)
Integracja GitHub w OpenCode, mimo problemów z rate limitami, zapewnia kompleksowy workflow. Połączenie z orkiestracją oh-my-opencode mogłoby umożliwić: automatyczne triage issue przez Prometheusa, generowanie planów przez Atlas, implementację przez Sisyphusa, oraz review przez Oracle — wszystko w ramach jednego, zintegrowanego procesu.
#### 5.1.3 LSP precision dla wszystkich operacji kodowych
Integracja LSP zapewnia precyzję, której czysto tekstowe narzędzia agentowe nie mogą osiągnąć. W połączonym narzędziu, każda operacja edycji kodu byłaby weryfikowana przez LSP, eliminując błędy składniowe i semantyczne.
### 5.2 Warstwa orkiestracji: oh-my-opencode
#### 5.2.1 Multi-agent parallel execution z inteligentnym routingiem
System kategorii agentów oh-my-opencode (visual-engineering, deep, quick, ultrabrain) mógłby być rozszerzony o dynamiczny routing zadań na podstawie: rozmiaru zadania, dostępnych zasobów, historycznej skuteczności modeli, oraz preferencji użytkownika. To stworzyłoby prawdziwie adaptacyjny system orkiestracyjny.
#### 5.2.2 Hash-anchored edits dla niezawodnych modyfikacji kodu
Mechanizm Hashline, poprawnie zaimplementowany, mógłby eliminować jeden z najczęstszych problemów narzędzi agentowych — drift kodu w długich sesjach, gdzie wielokrotne edycje nakładają się i tworzą nieprzewidywalne wyniki.
#### 5.2.3 Skill-embedded MCPs dla czystego context window
Architektura skilli z embedded MCP jest przewagą konkurencyjną, która powinna być zachowana i rozszerzona. W połączonym narzędziu, MCP serwery byłyby zarządzane przez centralny registry z wersjonowaniem i dependency resolution.
#### 5.2.4 Background agents dla długotrwałych zadań
System background agents jest kluczowy dla praktycznej użyteczności — umożliwia delegowanie zadań i kontynuowanie pracy, zamiast blokowania interfejsu. W połączeniu z proper notification system, tworzy to workflow zbliżony do asynchronicznego programowania.
### 5.3 Potencjalne unikalne możliwości połączenia
#### 5.3.1 Autonomiczny end-to-end development: issue → plan → kod → test → PR → review
Połączenie możliwości obu narzędzi umożliwia wizję “zero-touch development” dla odpowiednio zdefiniowanych zadań: Prometheus wywiaduje się z issue, Atlas generuje plan, Sisyphus implementuje, Hephaestus builduje i testuje, Oracle reviewuje kod, a system automatycznie tworzy PR. To nie zastępuje deweloperów, ale eliminuje powtarzalne operacje mechaniczne.
#### 5.3.2 Hybrid execution: szybkie iteracje (quick) + głęboka analiza (deep) równolegle
System kategorii oh-my-opencode mógłby być rozszerzony o równoległe wykonanie: quick agent dla szybkiej iteracji i feedbacku, deep agent dla gruntownej analizy, z merge wyników przez koordynatora. To wykracza poza obecne sekwencyjne podejście.
#### 5.3.3 Self-healing codebase: automatic snapshot + restore + retry z Hashline
Kombinacja snapshotów git (po naprawie) z Hashline (dla stabilności) i automatic retry logic (dla odporności na błędy) mogłaby stworzyć system, który automatycznie odtwarza się po nieudanych modyfikacjach.
#### 5.3.4 Cross-model intelligence: routing zadań do optymalnego modelu per-category
Routing zadań nie tylko per-category, ale dynamicznie w oparciu o aktualną dostępność, koszt i wydajność modeli, z fallback’ami i load balancingiem.

## 6. Mind map: Obecne możliwości połączonego narzędzia
┌─────────────────────────────────────────────────────────────────────────┐
│                    POŁĄCZONE NARZĘDZIE: OBECNE MOŻLIWOŚCI               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  AGENT SYSTEM   │  │ CODE INTELLIGENCE│  │ GITHUB INTEGRATION│       │
│  │                 │  │                  │  │                    │       │
│  │ • Multi-model   │  │ • LSP (rename,   │  │ • 6 trigger events:│       │
│  │   (Claude, GPT, │  │   goto-def,      │  │   issue_comment,   │       │
│  │   Gemini, Kimi, │  │   find-refs,     │  │   PR_review,       │       │
│  │   GLM,          │  │   diagnostics)   │  │   issues, PR,      │       │
│  │   OpenRouter)   │  │                  │  │   schedule,        │       │
│  │                 │  │ • AST-Grep       │  │   workflow_dispatch│       │
│  │ • Agent         │  │   (25+ languages)│  │                  │       │
│  │   categories:   │  │                  │  │ • Auto branch    │       │
│  │   visual-eng,   │  │ • Hash-anchored  │  │   creation       │       │
│  │   deep, quick,  │  │   edits          │  │                  │       │
│  │   ultrabrain    │  │   (Hashline)     │  │ • Auto PR        │       │
│  │                 │  │                  │  │   submission     │       │
│  │ • Parallel      │  │ • Tmux interactive│  │                  │       │
│  │   subagent      │  │   terminal       │  │ • Line-specific  │       │
│  │   execution     │  │   (REPLs,        │  │   code review    │       │
│  │                 │  │   debuggers,     │  │   with diff      │       │
│  │ • Background    │  │   TUIs)          │  │   context        │       │
│  │   agent         │  │                  │  │                  │       │
│  │   persistence   │  │                  │  │ • Custom prompt  │       │
│  │                 │  │                  │  │   workflows      │       │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐                              │
│  │ CONTEXT MGMT    │  │ COMPATIBILITY   │                              │
│  │                 │  │                 │                              │
│  │ • Skill-embedded│  │ • Claude Code   │                              │
│  │   MCPs          │  │   full compat   │                              │
│  │   (on-demand,   │  │   (hooks, cmds, │                              │
│  │   task-scoped)  │  │   skills, MCPs, │                              │
│  │                 │  │   plugins)      │                              │
│  │ • Built-in MCPs │  │                 │                              │
│  │   (web search,  │  │ • Plugin system │                              │
│  │   docs, GitHub  │  │   extensibility │                              │
│  │   code search)  │  │                 │                              │
│  │                 │  │ • Cross-platform│                              │
│  │ • Session       │  │   (desktop +    │                              │
│  │   persistence   │  │   CLI)          │                              │
│  │   via git       │  │                 │                              │
│  │   snapshots     │  │                 │                              │
│  │   [PROBLEMATIC] │  │                 │                              │
│  │                 │  │                 │                              │
│  │ • Real-time SSE │  │                 │                              │
│  │   event         │  │                 │                              │
│  │   broadcasting  │  │                 │                              │
│  │                 │  │                 │                              │
│  └─────────────────┘  └─────────────────┘                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

## 7. Mind map: Najbardziej brakujące elementy
┌─────────────────────────────────────────────────────────────────────────┐
│                    POŁĄCZONE NARZĘDZIE: BRAKUJĄCE ELEMENTY              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │  🚀 PERFORMANCE &   │  │   🎯 DEVELOPER      │  │  🔧 INTEGRATION │ │
│  │     RELIABILITY     │  │      EXPERIENCE     │  │    STABILITY    │ │
│  │                     │  │                     │  │                 │ │
│  │ • Intelligent git   │  │ • Comprehensive     │  │ • Bun runtime   │ │
│  │   snapshotting:     │  │   documentation     │  │   compatibility │ │
│  │   ├─ size-aware     │  │   website:          │  │   without AVX2  │ │
│  │   ├─ .gitignore-    │  │   - installation    │  │   requirement   │ │
│  │   │   respecting    │  │   - skills guide    │  │                 │ │
│  │   ├─ configurable   │  │   - hooks reference │  │ • Graceful      │ │
│  │   │   limits        │  │   - state mgmt      │  │   agent init    │ │
│  │   └─ lazy/eager/off │  │   - troubleshooting │  │   (no undefined │ │
│  │       modes         │  │                     │  │   crashes)      │ │
│  │                     │  │ • Clear, descriptive│  │                 │ │
│  │ • Auto Context      │  │   agent naming:     │  │ • Full          │ │
│  │   Compression:      │  │   - "CodeWriter"    │  │   `opencode     │ │
│  │   ├─ sliding window │  │     not "Sisyphus"  │  │   question`     │ │
│  │   ├─ auto-summarize │  │   - "DeepAnalyzer"  │  │   support       │ │
│  │   ├─ /compact cmd   │  │     not "Hephaestus"│  │                 │ │
│  │   └─ threshold      │  │   - "Planner"       │  │ • Custom agent  │ │
│  │       alerts        │  │     not "Prometheus"│  │   whitelist     │ │
│  │                     │  │                     │  │   configurability│ │
│  │ • Inference caching │  │ • Partial config    │  │                 │ │
│  │   dla powtarzalnych │  │   loading with      │  │ • GitHub Actions│ │
│  │   operacji          │  │   meaningful errors │  │   robustness:   │ │
│  │                     │  │                     │  │   - no hangs    │ │
│  │ • Pipeline          │  │ • Configuration     │  │   - proper      │ │
│  │   parallelism dla   │  │   validation with   │  │     error codes │ │
│  │   agent execution   │  │   granular feedback │  │   - agent       │ │
│  │                     │  │                     │  │     selection   │ │
│  │ • Memory usage      │  │                     │  │     flag        │ │
│  │   optimization &    │  │                     │  │                 │ │
│  │   leak prevention   │  │                     │  │                 │ │
│  │                     │  │                     │  │                 │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐                      │
│  │  💰 COST & TOKEN    │  │   🛡️ GOVERNANCE &   │                      │
│  │     EFFICIENCY      │  │      TRUST          │                      │
│  │                     │  │                     │                      │
│  │ • Context window    │  │ • Approval gates    │                      │
│  │   management z      │  │   dla production    │                      │
│  │   proaktywnymi      │  │   workflows         │                      │
│  │   thresholdami      │  │                     │                      │
│  │   (70%, 80%, 90%)   │  │ • Team-shared       │                      │
│  │                     │  │   context i         │                      │
│  │ • Token usage       │  │   coding standards  │                      │
│  │   transparency i    │  │                     │                      │
│  │   budgeting         │  │ • Audit trail dla   │                      │
│  │   per-session       │  │   agent actions     │                      │
│  │                     │  │                     │                      │
│  │ • Smart retry logic │  │ • Explicit human-   │                      │
│  │   bez 3x token waste│  │   in-the-loop dla   │                      │
│  │   (write-existing-  │  │   critical ops      │                      │
│  │   file-guard fix)   │  │                     │                      │
│  │                     │  │                     │                      │
│  │ • Cost-aware model  │  │                     │                      │
│  │   routing (cheap    │  │                     │                      │
│  │   for simple tasks) │  │                     │                      │
│  │                     │  │                     │                      │
│  └─────────────────────┘  └─────────────────────┘                      │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  PRIORYTET IMPLEMENTACJI:                                              │
│  P0 (blokujące): Intelligent git snapshot, Bun compatibility,          │
│                  Auto Context Compression, Documentation website        │
│  P1 (krytyczne): Clear agent naming, Partial config, Graceful init     │
│  P2 (ważne):     Token transparency, Audit trail, Approval gates       │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

| Funkcja | Projekt | Status | Uzasadnienie społeczności | Przyczyna odrzucenia/nieimplementacji |
| --- | --- | --- | --- | --- |
| Auto Context Compression | OpenCode | Otwarte od stycznia 2026 (Github) | Redukcja kosztów API o 60-80%, zapobieganie błędom “context window exceeded” | Wymaga fundamentalnej zmiany architektury sesji |
| Konfigurowalne limity snapshotów git | OpenCode | Brak odpowiedzi (Github) | Zapobieganie degradacji wydajności w dużych repozytoriach | Prawdopodobnie konflikt z założeniami “session management” |
| Przejrzyste nazwy agentów | oh-my-opencode | Odrzucone w #1995 (Github) | Niższy próg wejścia dla nowych użytkowników | Estetyka i “branding” projektu |
| Pełna dokumentacja website | oh-my-opencode | Częściowo zaakceptowane | Rozproszona dokumentacja utrudnia adopcję | Ograniczone zasoby deweloperskie |
| Wsparcie dla custom agents w call_omo_agent | oh-my-opencode | Brak odpowiedzi (Github) | Elastyczność dla zaawansowanych użytkowników | Złożoność bezpieczeństwa, sandboxing |


| Agent (nazwa mitologiczna) | Rola | Model domyślny | Specjalizacja |
| --- | --- | --- | --- |
| Sisyphus | Ultraworker | Claude 3.5 Sonnet | Autonomiczne wykonanie do skutku |
| Hephaestus | Deep Agent | Claude 3 Opus | Głęboka analiza, refaktoryzacja |
| Prometheus | Plan Builder | GPT-4 | Tworzenie planów, architektura |
| Atlas | Plan Executor | Gemini Pro | Wykonywanie planów, iteracja |
| Metis | Plan Consultant | Mixtral | Konsultacje, przeglądy planów |
| Momus | Plan Critic | Claude 3 Haiku | Krytyka, wykrywanie luk |


| Kategoria | Przeznaczenie | Przykładowe zadania |
| --- | --- | --- |
| visual-engineering | Frontend, UI/UX, design | React components, CSS, accessibility |
| deep | Autonomous research + execution | End-to-end features, complex refactoring |
| quick | Single-file changes, typos | Hotfixes, renaming, simple edits |
| ultrabrain | Hard logic, architecture decisions | System design, algorithm optimization |


| Obecna nazwa | Proponowana nazwa | Funkcja |
| --- | --- | --- |
| Sisyphus | Planner-Default | Główny agent planujący |
| Prometheus | Architect | Planowanie systemowe |
| Hephaestus | Frontend-Engineer | UI/UX development |
| Atlas | DevOps-Engineer | Infrastruktura |
| Oracle | Debugger | Troubleshooting |
