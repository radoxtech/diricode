# Analiza LiteLLM — Podsumowanie + Ankieta

> **Cel**: Ocenić co z LiteLLM warto wykorzystac w CodeWroc/DiriCode,
> szczegolnie jako handler do przełączania tego samego modelu
> z roznych subskrypcji/kont.
>
> Data analizy: 21 lutego 2026
> Repo: `/Users/rado/repos/diricode/litellm/`

---

## 1. CZYM JEST LiteLLM — w jednym zdaniu

**LiteLLM to Python SDK + proxy server (FastAPI), ktory ujednolica API 100+ providerow AI do jednego interfejsu OpenAI-compatible, z load balancingiem, fallbackami, cost trackingiem i rate limitingiem.**

---

## 2. KLUCZOWA FUNKCJA: Przełączanie tego samego modelu z roznych subskrypcji

### Jak to dziala

LiteLLM Router pozwala zdefiniowac **wiele deploymentow pod jednym aliasem**. Kazde zapytanie do aliasu jest automatycznie routowane do jednego z deploymentow wedlug wybranej strategii.

```yaml
# config.yaml — ten sam model, rozne klucze API
model_list:
  - model_name: gpt-4                    # <-- alias (user widzi to)
    litellm_params:
      model: gpt-4                       # <-- faktyczny model
      api_key: os.environ/OPENAI_KEY_1   # <-- subskrypcja 1
      rpm: 500
      tpm: 90000

  - model_name: gpt-4                    # <-- TEN SAM alias
    litellm_params:
      model: gpt-4
      api_key: os.environ/OPENAI_KEY_2   # <-- subskrypcja 2
      rpm: 500
      tpm: 90000

  - model_name: gpt-4                    # <-- TEN SAM alias, inny provider
    litellm_params:
      model: azure/gpt-4                 # <-- Azure zamiast OpenAI
      api_base: https://account-b.openai.azure.com/
      api_key: os.environ/AZURE_KEY
      rpm: 3600
```

```python
# Uzycie — router automatycznie load-balansuje
from litellm import Router

router = Router(model_list=model_list, routing_strategy="simple-shuffle")
response = await router.acompletion(
    model="gpt-4",  # Router sam wybierze deployment
    messages=[{"role": "user", "content": "Hello"}]
)
```

### Strategie routingu

| Strategia | Opis | Kiedy uzywac |
|-----------|------|-------------|
| `simple-shuffle` | Losowy wybor (domyslna) — respektuje wagi RPM/TPM | Ogolne uzycie |
| `usage-based-routing-v2` | Kieruje do deploymentu z najnizszym zuzyciem TPM/RPM | Rownomierne obciazenie |
| `cost-based-routing` | Wybiera najtanszy deployment | Optymalizacja kosztow |
| `latency-based-routing` | Wybiera najszybszy deployment | Niska latencja |
| `least-busy` | Najmniej rownoczesnych requestow | Duzy concurrency |

### Fallbacki

```yaml
# Jesli gpt-4 nie odpowiada, probuj gpt-3.5-turbo
general_settings:
  fallbacks:
    - gpt-4: [gpt-3.5-turbo]

# Jesli kontekst za duzy, fallback do modelu z wiekszym oknem
router_settings:
  context_window_fallbacks:
    - gpt-4: [gpt-4-128k]
```

### Cooldown & recovery

```yaml
router_settings:
  allowed_fails: 3      # Po 3 failach w 1 min → cooldown
  cooldown_time: 60      # 60s przerwy dla failed deploymentu
  num_retries: 3         # Retry przed fallbackiem
```

---

## 3. DWA TRYBY UZYCIA

### A) Python SDK (Router) — bezposrednio w aplikacji

```python
from litellm import Router

router = Router(model_list=[...])
response = await router.acompletion(model="gpt-4", messages=[...])
```

- Lekki, zero infrastruktury
- Stan routingu w pamieci (lub Redis dla multi-instance)
- Idealny do osadzenia w CodeWroc

### B) Proxy Server — centralny gateway HTTP

```bash
pip install 'litellm[proxy]'
litellm --config config.yaml --port 4000
```

- OpenAI-compatible endpoint (`POST /v1/chat/completions`)
- Dowolny klient (curl, Python, JS, Go) komunikuje sie tak samo
- Multi-tenant: virtual API keys, teamy, budgety
- Dashboard do zarzadzania

---

## 4. MAPOWANIE NA WYMAGANIA CodeWroc (zyczenia-codewroc.md)

| Wymaganie CodeWroc | LiteLLM pokrywa? | Jak |
|---------------------|------------------|-----|
| **4.1 Prawdziwy multi-provider** | TAK | 100+ providerow, jeden interfejs |
| **4.2 Per-agent model assignment** | CZESCIOWO | Router moze miec rozne aliasy per agent — ale logika przypisania musi byc w CodeWroc |
| **4.2 Token budget per task** | TAK (proxy) | `max_budget` per klucz API / team |
| **4.2 Real-time token counter** | TAK | `completion_cost()` po kazdym requeście |
| **4.2 Cost estimation** | NIE | Brak pre-estimation, tylko post-factum |
| **4.3 Fallback chain** | TAK | `fallbacks`, `context_window_fallbacks`, `content_policy_fallbacks` |
| **4.3 Rate limit awareness** | TAK | RPM/TPM per deployment, `usage-based-routing` |
| **4.3 OpenRouter support** | TAK | `openrouter/model-name` |
| **4.3 Ollama support** | TAK | `ollama/model-name` |
| **4.3 HTTP_PROXY support** | TAK | Standardowe env vars |
| **H1 Dedykowany proxy AI** | TAK | LiteLLM Proxy = gotowy proxy |
| **H2 Race mode** | NIE | Brak natywnego — trzeba dopisac |
| **H3 Consensus mode** | NIE | Brak natywnego — trzeba dopisac |
| **H4 Cost mode** | CZESCIOWO | `cost-based-routing` routuje do najtanszego, ale nie porownuje jakosci |
| **H5 Circuit breaker** | TAK | Cooldown + allowed_fails |
| **H6 Health check** | TAK | Automatyczne cooldowny po failach |
| **H7 OpenAI-compatible API** | TAK | Natywnie |
| **H9 Per-request cost attribution** | TAK | `completion_cost()` per request |

---

## 5. CO LiteLLM DAJE ZA DARMO (nie trzeba pisac)

1. **Ujednolicone API** — jeden `completion()` dla OpenAI, Azure, Anthropic, Bedrock, Vertex, Ollama, etc.
2. **Load balancing** — 5 strategii, weighted routing, cooldowny
3. **Fallbacki** — per model, per context window, per content policy
4. **Cost tracking** — pricing 100+ modeli, budgety per klucz/team/org
5. **Rate limiting** — RPM/TPM per deployment, per klucz
6. **Caching** — Redis, in-memory, S3, dysk
7. **Logging** — Langfuse, MLflow, Datadog, OpenTelemetry
8. **Virtual API keys** — generowanie kluczy z budzetami i limitami
9. **Streaming** — SSE natywnie

---

## 6. CZEGO LiteLLM NIE DAJE (trzeba dopisac do CodeWroc)

1. **Race mode** — wyslij do N providerow, wez pierwsza odpowiedz
2. **Consensus mode** — wyslij do N, agreguj wyniki
3. **Pre-estimation kosztu** — "ten plan bedzie kosztowal ~$X"
4. **Inteligentne przypisanie modelu do agenta** — logika "deep agent = Opus, quick = Haiku"
5. **Token budget enforcement na poziomie taska** (nie klucza API)
6. **Integracja z systemem agentow** — LiteLLM nie wie co to agent
7. **TypeScript** — LiteLLM jest w Pythonie. Dla CodeWroc (TS) trzeba albo:
   - Uzywac jako proxy (HTTP) — najlatwiej
   - Przepisac logike routingu w TS (np. z Vercel AI SDK)
   - Uzywac child process / sidecar

---

## 7. REKOMENDACJA: Jak uzyc LiteLLM w CodeWroc

### Opcja A: LiteLLM Proxy jako sidecar (REKOMENDOWANA)

```
CodeWroc (TypeScript) --HTTP--> LiteLLM Proxy (Python, port 4000) ---> OpenAI/Azure/Anthropic/Ollama
```

- CodeWroc widzi jeden endpoint
- Config w YAML, zarzadzanie modelami niezalezne od kodu TS
- Mozna uruchomic jako Docker container obok CodeWroc
- Zero Pythona w CodeWroc codebase

### Opcja B: Przepisac routing w TypeScript (Vercel AI SDK)

- Pelna kontrola, zero dependency na Python
- Wiecej pracy — trzeba zaimplementowac load balancing, fallbacki, cooldowny
- Vercel AI SDK pokrywa ~60% tego co Router

### Opcja C: Hybrid — LiteLLM Router embeddowany via Python bridge

- np. `child_process.spawn("python", ["-c", "from litellm import Router..."])`
- Zlozonosc, debugging, deployment — raczej unikac

---

# ANKIETA — Ktore funkcje LiteLLM chcesz wykorzystac?

> Wypelnij kolumne **Decyzja**:
> - **UZYWAM** — bierzemy z LiteLLM
> - **PISZE SAM** — implementujemy w TypeScript
> - **NIE POTRZEBUJE** — pomijamy
> - **DO DYSKUSJI** — wymaga wiecej analizy

---

## L1. SPOSOB INTEGRACJI

| # | Opcja | Opis | Decyzja | Uwagi |
|---|-------|------|---------|-------|
| L1.1 | **LiteLLM Proxy jako sidecar** | HTTP gateway, Docker/process obok CodeWroc | | |
| L1.2 | **Przepisac routing w TS** | Wlasna implementacja z Vercel AI SDK / od zera | | |
| L1.3 | **Hybrid** (Python bridge) | Nie rekomendowane | | |

---

## L2. ROUTING I LOAD BALANCING

| # | Funkcja LiteLLM | Opis | Decyzja | Uwagi |
|---|-----------------|------|---------|-------|
| L2.1 | **Load balancing miedzy subskrypcjami** | Ten sam model, rozne API keys, auto-routing | | |
| L2.2 | **simple-shuffle** (losowy routing) | Domyslna strategia, najszybsza | | |
| L2.3 | **usage-based-routing** (wg zuzycia TPM/RPM) | Rownomierne obciazenie | | |
| L2.4 | **cost-based-routing** (najtanszy deployment) | Minimalizacja kosztow | | |
| L2.5 | **latency-based-routing** (najszybszy) | Dla niskiej latencji | | |
| L2.6 | **least-busy** (najmniej requestow) | Dla duzego concurrency | | |
| L2.7 | **Weighted routing** (wagi per deployment) | Np. 90% primary, 10% backup | | |
| L2.8 | **Order-based priority** (explicite primary → fallback) | Deterministyczny fallback | | |

---

## L3. FALLBACKI I RELIABILITY

| # | Funkcja LiteLLM | Opis | Decyzja | Uwagi |
|---|-----------------|------|---------|-------|
| L3.1 | **Model fallback** (gpt-4 fail → gpt-3.5-turbo) | Degradacja do tanszego modelu | | |
| L3.2 | **Context window fallback** (za duzy prompt → wiekszy model) | Auto-upgrade okna kontekstu | | |
| L3.3 | **Content policy fallback** (filtracja → inny model) | Obejscie content filters | | |
| L3.4 | **Cooldown mechanism** (N failures → temporary disable) | Circuit breaker per deployment | | |
| L3.5 | **Automatic retries** (num_retries z backoff) | Retry przed fallbackiem | | |

---

## L4. COST TRACKING I BUDZETY

| # | Funkcja LiteLLM | Opis | Decyzja | Uwagi |
|---|-----------------|------|---------|-------|
| L4.1 | **Per-request cost tracking** (ile kosztowal kazdy request) | Dokładne koszty post-factum | | |
| L4.2 | **Budget per API key** (max $X/dzien/miesiac) | Hard limit wydatkow | | |
| L4.3 | **Budget per team** (kilka kluczy, wspolny budzet) | Kontrola per zespol | | |
| L4.4 | **Budget per model** (gpt-4 max $10/dzien) | Limit per model | | |
| L4.5 | **Soft budget** (alert bez blokady) | Ostrzezenie przed limitem | | |
| L4.6 | **Spend dashboard** (wizualizacja kosztow) | Next.js UI do przegladania | | |

---

## L5. RATE LIMITING

| # | Funkcja LiteLLM | Opis | Decyzja | Uwagi |
|---|-----------------|------|---------|-------|
| L5.1 | **RPM/TPM per deployment** (respektowanie limitow providera) | Auto-routing wg limitow | | |
| L5.2 | **RPM/TPM per API key** (wlasne limity per klucz) | Kontrola zuzycia per user | | |
| L5.3 | **Max parallel requests** (concurrency limit) | Ochrona przed flood | | |

---

## L6. CACHING

| # | Funkcja LiteLLM | Opis | Decyzja | Uwagi |
|---|-----------------|------|---------|-------|
| L6.1 | **In-memory cache** (proste, zero setup) | Powtorzone prompty = instant | | |
| L6.2 | **Redis cache** (wspoldzielony miedzy instancjami) | Dla multi-instance | | |
| L6.3 | **Semantic cache** (podobne prompty → cached odpowiedz) | Oszczednosc na zbliżonych pytaniach | | |

---

## L7. OBSERVABILITY I LOGGING

| # | Funkcja LiteLLM | Opis | Decyzja | Uwagi |
|---|-----------------|------|---------|-------|
| L7.1 | **Langfuse integration** (tracing, prompty, koszty) | Popularne OSS narzedzie | | |
| L7.2 | **OpenTelemetry export** (traces, metryki) | Standard dla observability | | |
| L7.3 | **Custom callbacks** (wlasna logika po kazdym request) | Np. logowanie do wlasnej DB | | |

---

## L8. MULTI-TENANCY (Proxy)

| # | Funkcja LiteLLM | Opis | Decyzja | Uwagi |
|---|-----------------|------|---------|-------|
| L8.1 | **Virtual API keys** (generowanie kluczy z limitami) | Kazdy agent/user ma swoj klucz | | |
| L8.2 | **Teams** (grupowanie kluczy, wspolne budzety) | Organizacja per zespol | | |
| L8.3 | **Model access control** (team A widzi gpt-4, team B nie) | Granularne uprawnienia | | |
| L8.4 | **JWT/OAuth2 auth** | SSO, enterprise auth | | |

---

## L9. UNIKALNE FUNKCJE CodeWroc (poza LiteLLM)

| # | Funkcja | Opis | Decyzja | Uwagi |
|---|---------|------|---------|-------|
| L9.1 | **Race mode** — wyslij do N providerow, wez pierwsza odpowiedz | Minimalizacja latencji kosztem $$ | | |
| L9.2 | **Consensus mode** — N odpowiedzi, agregacja wynikow | Wieksza jakosc kosztem $$ | | |
| L9.3 | **Pre-estimation kosztu planu** ("ten plan ~$2.50") | UX, swiadome decyzje | | |
| L9.4 | **Per-agent model assignment** (dyspozytor=Haiku, deep=Opus) | Inteligentny dobor modelu | | |
| L9.5 | **Token budget per task** (nie per klucz API) | Granularna kontrola | | |

---

## PODSUMOWANIE — Quick reference

```
                    LiteLLM daje         Trzeba dopisac
                    ───────────          ──────────────
Routing:            ████████████         ░░ (race/consensus)
Fallbacki:          ████████████
Cost tracking:      ██████████░░         ░░ (pre-estimation)
Rate limiting:      ████████████
Caching:            ████████████
Multi-tenant:       ████████████
Agent integration:  ░░░░░░░░░░░░         ████████████
TypeScript native:  ░░░░░░░░░░░░         ████████████ (jesli Opcja B)
Race/Consensus:     ░░░░░░░░░░░░         ████████████
```

---

> **Instrukcja**: Przejdz punkt po punkcie (L1-L9) i wpisz UZYWAM / PISZE SAM / NIE POTRZEBUJE / DO DYSKUSJI.
> Po wypelnieniu → zaprojektujemy integracje LiteLLM z architektura CodeWroc.
