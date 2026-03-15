# Analiza Projektów OpenCode i Oh-My-OpenCode

### Kompleksowa analiza issue na GitHub, problemów, brakuj�cych funkcjonalno�ci i potencja�u integracji

Z.ai Analysis Report


## 1. Wprowadzenie do Projektów

### 1.1 OpenCode - Otwarto�ród�owy Agent Koduj�cy

OpenCode to pot��ny, terminalowy agent AI do programowania, który zyska�


ogromn� popularno�� w spo�eczno�ci deweloperskiej. Projekt posiada ponad


100,000 gwiazdek na GitHub, 700 wspó�twórców i jest u�ywany przez ponad 2.5


miliona deweloperów miesi�cznie. Jest dost�pny jako interfejs terminalowy


(TUI), aplikacja desktopowa oraz rozszerzenie IDE.


G�ówne cechy OpenCode obejmuj�: natywn� integracj� LSP (Language Server


Protocol) automatycznie �aduj�c� odpowiednie serwery j�zykowe, obs�ug�


ponad 75 ró�nych modeli AI w tym Claude, GPT, Gemini oraz modele lokalne,


system agentów z trybami Build i Plan, oraz mo�liwo�� pracy z wieloma


sesjami jednocze�nie. Projekt jest w pe�ni open-source i nie przechowuje


kodu u�ytkownika, co czyni go odpowiednim dla �rodowisk wymagaj�cych


prywatno�ci.

### 1.2 Oh-My-OpenCode - Warstwa Orkiestracji


Oh-My-OpenCode to "batteries-included orchestration layer" dla OpenCode 

kompleksowa wtyczka rozszerzaj�ca mo�liwo�ci podstawowego narz�dzia.


Zamiast by� kolejnym generycznym narz�dziem AI, opakowuje oficjalny runtime


OpenCode z wyspecjalizowanymi agentami, hookami, MCPs i konfiguracj�,


dostarczaj�c niezawodne workflow wieloagentowe "out of the box". Wersja 3.0


zosta�a oznaczona jako stabilna i wprowadza znacz�ce ulepszenia.


Projekt oferuje: mo�liwo�� uruchamiania agentów w tle, wyspecjalizowane


agenty takie jak oracle (odpowiedzi na pytania), librarian (zarz�dzanie


wiedz�), i frontend engineer, zaawansowane narz�dzia LSP/AST,


wyselekcjonowane MCPs (Model Context Protocol), oraz pe�n� warstw�


kompatybilno�ci z Claude Code i systemem superpowers. Umo�liwia to prac�


wielu modeli równolegle jako wyspecjalizowanych agentów.


## 2. Mapa My�li: Funkcjonalno�ci

Poni�sza mapa my�li przedstawia g�ówne funkcjonalno�ci po��czenia


OpenCode z Oh-My-OpenCode. Wizualizacja pokazuje cztery g�ówne obszary:


OpenCode Core, Oh-My-OpenCode Extensions, File Operations oraz AI Capabilities.


Rysunek 1: Mapa my�li funkcjonalno�ci OpenCode + Oh-My-OpenCode


## 3. Najwi�ksze Problemy Zidentyfikowane w GitHub Issues

### 3.1 Problemy z Pami�ci� i Kontekstem

Najpowa�niejszym problemem zg�aszanym przez u�ytkowników s� kwestie


zwi�zane z zarz�dzaniem pami�ci� i oknem kontekstowym. OpenCode


do�wiadcza znacz�cych problemów z utrat� kontekstu w d�ugich sesjach 

agent "zapomina" wcze�niejsze informacje, co wymusza powtarzanie instrukcji.


Issue #9743 dokumentuje przypadek, w którym proces OpenCode zaalokowa� oko�o


109GB pami�ci wirtualnej przy tylko 23GB fizycznej, co sugeruje powa�ne


wycieki pami�ci lub fragmentacj� sterty V8.


Model context limits nie s� odpowiednio respektowane (issue #11286), a


OpenCode potrafi ulec awarii przy próbie odczytu zbyt du�ych plików.


U�ytkownicy zg�aszaj�, �e brak sliding window context management powoduje


problemy w d�ugotrwa�ych sesjach pracy. Istniej� rozwi�zania


spo�eczno�ciowe jak supermemory plugin czy working memory plugin, ale nie


s� one zintegrowane z podstawowym systemem.

### 3.2 Problemy z Interfejsem U�ytkownika


Liczne b��dy UI/UX obni�aj� u�yteczno�� narz�dzia: blank screen po


instalacji oh-my-opencode (issue #596), nierówne dzia�anie przycisków


Accept/Reject Changes (issue #8575), glitche w oknie pomocy przy scrollowaniu


(issue #3567), problemy z layoutem wiadomo�ci w tmux nie renderuj�cym si�


na pe�n� szeroko�� (issue #2428). UI potrafi si� "zawiesi�" i sta� si�


nieodpowiadaj�cym, co utrudnia prac�.

### 3.3 Problemy z Git i Operacjami Plikowymi


Issue #3176 ("Why is OpenCode massively abusing git?") zwraca uwag� na


niepokoj�ce zachowanie: OpenCode wykonuje "git add ." w katalogach o


rozmiarze 45GB z 54,000 plikami, co jest zupe�nie nieuzasadnione. Problem ten


dotyczy szczególnie Windows i interakcji z Git. Dodatkowo istniej� problemy z


kompatybilno�ci� AVX2 na starszych procesorach - OpenCode crashuje si� z "


illegal instruction" na CPU bez obs�ugi AVX2.


### 3.4 Tabela Kluczowych Issue

|Nr Issue|Typ|Opis Problemu|Status|
|---|---|---|---|
|#9743|Bug|Memory Leak - 109GB virtual memory allocation|Open|
|#11286|Bug|Model context limits not respected|Open|
|#3176|Bug|Git abuse - massive git operations|Open|
|#8575|Bug|Missing Accept/Reject buttons in App|Open|
|#4659|Feature|Sliding window context management|Open|
|#7006|Bug|Permission hook defined but not triggered|Open|



Tabela 1: Kluczowe issue w repozytorium OpenCode


## 4. Problemy Specyficzne dla Oh-My-OpenCode

Oh-My-OpenCode, mimo swoich zalet, wprowadza w�asny zestaw problemów.


Konflikty mi�dzy planning-with-files a oh-my-opencode (issue #1560)


powoduj�, �e nawet przy imporcie narz�dzia superpowers, agent zapomina


regu�y planowania. Narz�dzia oh-my-opencode powoduj� b��dy JSON Schema


(issue #1183), a usuni�cie wtyczki rozwi�zuje problem, co potwierdza


konflikt w zarejestrowanych narz�dziach.


Krytycznym problemem jest ca�kowite ignorowanie natywnych skills OpenCode


przez oh-my-opencode (issue #352 w superpowers). OMO u�ywa w�asnej


implementacji zbudowanej na tools i hooks, ignoruj�c system skills OpenCode.


Dodatkowo pojedyncze nieprawid�owe pole w konfiguracji oh-my-opencode.json


dyskretnie odrzuca ca�� konfiguracj� (issue #1767), a wszystkie nadpisania


modeli agentów s� tracone bez ostrze�enia.

### 4.1 Tabela Issue Oh-My-OpenCode


|Nr Issue|Typ|Opis Problemu|
|---|---|---|
|#1560|Bug|Conflicts with planning-with-files tool|
|#1183|Bug|JSON Schema errors from registered tools|
|#596|Bug|Blank screen after installation on macOS|
|#361|Bug|Severe memory leak with OMO enabled|
|#1767|Bug|Single invalid config field discards all config|
|#1995|Feature|Need clear agent names instead of myth names|


## 5. Mapa My�li: Brakuj�ce i Problematyczne Funkcje

Poni�sza mapa my�li kategoryzuje najwa�niejsze brakuj�ce funkcje i


problemy, które u�ytkownicy zg�aszaj� jako najbardziej dotkliwe. Podzielone


s� na cztery g�ówne kategorie: Memory & Context, UI/UX Issues, Architecture


Problems oraz Rejected Features.


Rysunek 2: Mapa my�li brakuj�cych i problematycznych funkcji


## 6. Czego Autorzy Nie Chc� Wprowadza� (a By�oby Korzystne)

### 6.1 Natywne Skills OpenCode vs W�asna Implementacja OMO

Najbardziej kontrowersyjn� decyzj� projektow� jest ca�kowite ignorowanie


natywnego systemu skills OpenCode przez oh-my-opencode. Zamiast wykorzysta�


istniej�c� infrastruktur�, OMO tworzy w�asn� implementacj� opart� na


tools i hooks. Powoduje to fragmentacj� ekosystemu i uniemo�liwia


korzystanie z skills spo�eczno�ci. U�ytkownicy zg�aszaj�, �e OMO "


ignoruje OpenCode skills", co jest �wiadom� decyzj� architektoniczn�, ale


ogranicza interoperacyjno��.

### 6.2 Brak Sliding Window Context Management


Issue #4659 proponuje sliding window dla zarz�dzania kontekstem w


d�ugotrwa�ych sesjach. Zamiast odcina� kontekst i próbowa� odzyskiwa� go


z podsumowań, przesuwany by�by znacznik compact forward przez histori�.


Funkcja ta nie zosta�a zaimplementowana, mimo �e rozwi�za�aby podstawowy


problem utraty kontekstu. Autorzy preferuj� istniej�cy mechanizm compact,


który wielu u�ytkowników uwa�a za niewystarczaj�cy.

### 6.3 Niewyra�ne Nazwy Agentów


Issue #1995 w oh-my-opencode wprost stawia problem: u�ytkownicy potrzebuj�


jasnych nazw agentów zamiast mitologicznych jak "Sisyphus". Ludzie chc� móc


nazwa� swoich agentów zrozumia�ymi nazwami. Propozycja obejmuje równie�


potrzeb� proper documentation website. Jest to request feature, który


pozostaje otwarty i wskazuje na nacisk na "cool naming" zamiast u�yteczno�ci.

### 6.4 Deny Tool Use with Custom Message


Issue #7817 w OpenCode prosi o mo�liwo�� odrzucenia u�ycia narz�dzia z


w�asn� wiadomo�ci� dla LLM. U�ytkownik chce móc odrzuci� ��dania


web-fetch i zamiast tego poinstruowa� agenta, by u�y� glab CLI. Obecnie


rejection po prostu odrzuca bez mo�liwo�ci podania alternatywy. Ta funkcja


by�aaby bardzo przydatna w pipeline CI/CD.


## 7. Co Potrafi� Razem: Potencja� Integracji

Po��czenie OpenCode z Oh-My-OpenCode tworzy pot��n� platform�


programistyczn� AI. G�ówne mo�liwo�ci obejmuj�:

### 7.1 Multi-Agent Orchestration


OMO umo�liwia orkiestracj� wielu wyspecjalizowanych agentów pracuj�cych


równolegle. Oracle odpowiada na pytania, librarian zarz�dza baz� wiedzy,


frontend engineer specjalizuje si� w UI, a background agents mog� pracowa�


autonomicznie. To podej�cie "team-based" znacznie przewy�sza mo�liwo�ci


pojedynczego agenta i pozwala na podzia� pracy wed�ug kompetencji.

### 7.2 Claude Code Compatibility Layer


Warstwa kompatybilno�ci z Claude Code pozwala na migracj� z ekosystemu


Anthropic przy zachowaniu workflow. Superpowers layer zapewnia dodatkowe


zdolno�ci jak planning-with-files, code review automation, i structured


outputs. U�ytkownicy Claude Code mog� przej�� na open-source z minimalnym


frictinem.

### 7.3 LSP/AST Deep Integration


Zaprojektowane narz�dzia LSP i AST zapewniaj� g��bokie zrozumienie kodu:


goto definition, find references, rename refactoring, i symbol search s�


dost�pne bezpo�rednio w terminalu. To przewaga nad IDE-bound AI assistants i


pozwala na prac� w �rodowiskach headless/remote.

### 7.4 Multi-Model Flexibility


Wsparcie dla 75+ modeli oznacza wolno�� od vendor lock-in. Mo�na u�ywa�


Claude, GPT, Gemini, modeli lokalnych (Ollama), lub dowolnej kombinacji. OMO


pozwala przypisa� ró�ne modele do ró�nych agentów - np. Claude dla code


review, GPT dla dokumentacji, model lokalny dla szybkich zapytań. To znacz�ca


oszcz�dno�� kosztów i zwi�kszenie prywatno�ci.


## 8. Rekomendacje

### 8.1 Priorytety Rozwoju dla OpenCode

|Priorytet|Obszar|Rekomendacja|
|---|---|---|
|Krytyczny|Memory|Implementacja sliding window context management|
|Krytyczny|Memory|Naprawa memory leak - analiza V8 heap|
|Wysoki|UI/UX|Stabilizacja TUI - fix blank screens, unresponsive<br>buttons|
|Wysoki|Git|Ograniczenie git operations do istotnych plików|
|�redni|Permissions|Pe�na implementacja permission hooks|
|�redni|Tools|Custom rejection messages dla tool use|



Tabela 3: Rekomendacje dla OpenCode

### 8.2 Priorytety Rozwoju dla Oh-My-OpenCode

|Priorytet|Obszar|Rekomendacja|
|---|---|---|
|Krytyczny|Config|Lepsza walidacja konfiguracji z komunikatami b��dów|
|Krytyczny|Compat|Integracja z natywnym systemem skills OpenCode|
|Wysoki|Naming|Przejrzyste nazwy agentów zamiast mitologicznych|
|Wysoki|Docs|Stworzenie proper documentation website|
|�redni|Conflict|Rozwi�zanie konfliktów z planning tools|



Tabela 4: Rekomendacje dla Oh-My-OpenCode

## 9. Podsumowanie


OpenCode i Oh-My-OpenCode stanowi� pot��ne po��czenie w ekosystemie AI


coding agents. OpenCode dostarcza solidne fundamenty: terminal-native


interface, LSP integration, multi-model support. Oh-My-OpenCode dodaje


warstw� orkiestracji multi-agent, specjalistyczne agenty i kompatybilno�� z


Claude Code. Razem tworz� platform� mog�c� konkurowa� z komercyjnymi


rozwi�zaniami.


Jednak oba projekty maj� znacz�ce problemy: zarz�dzanie pami�ci� (wycieki


do 109GB), utrata kontekstu w d�ugich sesjach, niestabilno�� UI, konflikty


mi�dzy OMO a natywnymi systemami OpenCode. Decyzje architektoniczne jak


ignorowanie skills OpenCode lub brak sliding window context management


ograniczaj� potencja� narz�dzi. Adresowanie tych kwestii by�oby


kluczowedla szerszej adopcji.


Mimo problemów, kombinacja oferuje unikaln� warto��: pe�na kontrola nad


modelami, brak vendor lock-in, prywatno�� danych, i mo�liwo�� pracy w


�rodowiskach terminalowych/remote. Dla zespo�ów deweloperskich szukaj�cych


alternatywy dla Claude Code czy Cursor, OpenCode + Oh-My-OpenCode stanowi


atrakcyjn� opcj� - pod warunkiem �wiadomo�ci ograniczeń i pracy nad ich


eliminacj�.


