# PHASE 3 --- BOOKING COMMERCIAL TERMS / PAYMENT SCHEDULE / AGREEMENT VERSIONING

## FINAL GIT & EVIDENCE CLOSURE

------------------------------------------------------------------------

# 1. ЦЕЛЬ

Закрыть только формально незавершённую Git/evidence часть уже
выполненного:

``` text
PHASE_3_BOOKING_COMMERCIAL_TERMS_AGREEMENT_ARCHITECTURE_ROADMAP_RECONCILIATION
```

Содержательная Architecture/Roadmap reconciliation уже выполнена и
повторно реализовываться НЕ должна.

Текущий report уже фиксирует:

``` text
Architecture updated
Roadmap updated
Booking Commercial Terms & Agreement Foundation = PLANNED — NOT STARTED
Production code changed = NO
Decision Queue Round 4 not affected
CRM Step 3.5 not started
```

Но report одновременно содержит незакрытые Git gates:

``` text
Commit = PENDING
HEAD == origin/master = PENDING / NO
Pushed = NO
```

Нужно устранить только это несоответствие и получить доказанный final
closure.

------------------------------------------------------------------------

# 2. SOURCE OF TRUTH

Проверить существующие файлы:

``` text
docs/architecture/booking-commercial-terms-agreement-versioning-audit.md
docs/architecture/README.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
docs/prompts/PHASE_3_BOOKING_COMMERCIAL_TERMS_AGREEMENT_ARCHITECTURE_ROADMAP_RECONCILIATION_REPORT.md
```

Не переписывать уже согласованную архитектуру без обнаружения реального
дефекта.

------------------------------------------------------------------------

# 3. PRE-COMMIT AUDIT

Перед commit выполнить:

``` text
git status
git diff
git diff --cached
git log -n 5 --oneline
```

Определить все modified/untracked files.

Разделить их на:

``` text
A. Files belonging to this reconciliation
B. Unrelated files
```

------------------------------------------------------------------------

# 4. UNRELATED FILES --- HARD RULE

В предыдущем report был указан:

``` text
scripts/generate-clients-report.mjs
```

как:

``` text
NEW — unrelated utility
```

Этот и любые другие unrelated files:

``` text
НЕ добавлять в commit
НЕ удалять
НЕ изменять
НЕ stash без необходимости
```

Они могут остаться untracked/modified в working tree.

Final report должен честно это показать.

------------------------------------------------------------------------

# 5. VERIFY ARCHITECTURE CONTENT

До commit подтвердить, что architecture document действительно содержит
зафиксированные решения:

``` text
Service commercial terms versioning
Booking immutable commercial snapshot
PAY_AFTER_CONFIRMATION / PAY_IMMEDIATELY concept
supplier-defined payment deadline within platform limits
full + partial payment
payment schedules/installments
final payment deadline
missed-payment policy
cancellation/refund separation
Customer Payment != Supplier Settlement
Booking Agreement
customer acceptance
two-stage agreement flow where applicable
same canonical agreement for both parties
document immutability/hash
amendments instead of overwrite
audit trail
CRM as consumer, not authority
```

Не реализовывать production code.

------------------------------------------------------------------------

# 6. VERIFY ROADMAP CONTENT

Подтвердить наличие future capability:

``` text
Booking Commercial Terms & Agreement Foundation
```

и sub-scope:

``` text
F.1  Service Commercial Policy Model
F.2  Service Terms Versioning
F.3  Payment Schedule Templates
F.4  Customer Payment Option Selection
F.5  Booking Commercial Snapshot
F.6  Installment Schedule Instantiation
F.7  Customer Acceptance
F.8  Supplier Confirmation Separation
F.9  Agreement Generation & Versioning
F.10 Amendments
F.11 Audit Trail Extension
F.12 CRM Consumption
F.13 Operational / Command Center Integration
```

Status должен оставаться:

``` text
PLANNED — NOT STARTED
```

Не запускать F.1--F.13.

------------------------------------------------------------------------

# 7. VERIFY CATALOG FUTURE WIDGET

Подтвердить, что future Catalog Health widget сохранён:

``` text
Ожидают публикации
```

Canonical cohort:

``` text
REVIEWED
UI = Проверен
```

Metrics:

``` text
service count
+
sum of canonical service prices
```

Semantics:

``` text
NOT GMV
NOT Revenue
NOT Payments
```

Runtime status:

``` text
NOT IMPLEMENTED
```

Не реализовывать widget в этом closure.

------------------------------------------------------------------------

# 8. VERIFY NO PRODUCTION CODE CHANGE

Проверить diff.

Hard gate:

``` text
Production implementation code changed by this reconciliation = NO
```

Если обнаружены production changes, которые принадлежат другому заданию:

``` text
не включать их в этот commit
```

Если production changes принадлежат именно этому reconciliation --- STOP
и вернуть VERDICT B, потому что исходный scope был documentation-only.

------------------------------------------------------------------------

# 9. REPORT CORRECTION

Обновить существующий report:

``` text
docs/prompts/PHASE_3_BOOKING_COMMERCIAL_TERMS_AGREEMENT_ARCHITECTURE_ROADMAP_RECONCILIATION_REPORT.md
```

Только additive/final evidence closure.

Не удалять историю первоначального состояния.

Добавить final closure section, например:

``` text
FINAL GIT / EVIDENCE CLOSURE
```

------------------------------------------------------------------------

# 10. ACCEPTANCE CRITERIA CORRECTION

В final state:

``` text
Commit created = PASS
Push = PASS
HEAD == origin/master = PASS
```

Только после фактического выполнения.

Не менять PENDING → PASS до получения Git evidence.

------------------------------------------------------------------------

# 11. COMMIT

В commit включить только файлы reconciliation.

Expected scope:

``` text
docs/architecture/booking-commercial-terms-agreement-versioning-audit.md
docs/architecture/README.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
docs/prompts/PHASE_3_BOOKING_COMMERCIAL_TERMS_AGREEMENT_ARCHITECTURE_ROADMAP_RECONCILIATION_REPORT.md
```

Фактический список определить по Git diff.

Suggested commit message:

``` text
docs(phase3): close booking commercial terms architecture reconciliation
```

------------------------------------------------------------------------

# 12. PUSH

После commit:

``` text
git push origin master
```

Если branch отличается от ожидаемого --- сначала проверить repository
state и не делать опасный force operation.

Запрещено:

``` text
git push --force
git reset --hard
```

------------------------------------------------------------------------

# 13. POST-PUSH EVIDENCE

После push выполнить и записать:

``` text
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log -1 --oneline
```

Hard gate:

``` text
HEAD == origin/master
```

------------------------------------------------------------------------

# 14. WORKING TREE SEMANTICS

`git status --short` не обязан быть пустым, если существуют заранее
известные unrelated files.

Нужно доказать:

``` text
No uncommitted reconciliation changes remain.
```

Если остаётся:

``` text
scripts/generate-clients-report.mjs
```

или другой unrelated artifact --- перечислить отдельно как:

``` text
UNRELATED / NOT INCLUDED
```

Не выдавать `working tree clean`, если это неправда.

------------------------------------------------------------------------

# 15. NO TEST SUITE REQUIREMENT

Поскольку reconciliation documentation-only:

полный regression запускать не требуется только ради Git closure.

Но проверить минимум:

``` text
no production code in commit
roadmap markdown readable
architecture markdown readable
report internally consistent
git diff commit scope correct
```

Если разработчик по своей инициативе запускает tests --- можно записать
evidence, но это не заменяет Git gates.

------------------------------------------------------------------------

# 16. REQUIRED FINAL MATRIX

Вернуть:

  Gate                                                   Result
  ------------------------------------------------------ -------------
  Architecture reconciliation present                    
  Roadmap capability F.1--F.13 present                   
  Capability status PLANNED --- NOT STARTED              
  Catalog "Ожидают публикации" future widget preserved   
  Production code changed                                NO
  Unrelated files committed                              0
  Reconciliation commit                                  SHA
  Push origin/master                                     
  HEAD                                                   SHA
  origin/master                                          SHA
  HEAD == origin/master                                  
  Uncommitted reconciliation changes                     0
  Unrelated working-tree files                           list / none

------------------------------------------------------------------------

# 17. VERDICT

Только если все hard gates выполнены:

``` text
VERDICT A — BOOKING COMMERCIAL TERMS / PAYMENT SCHEDULE / AGREEMENT VERSIONING ARCHITECTURE & ROADMAP RECONCILIATION FULLY CLOSED / GIT EVIDENCE COMPLETE
```

Если commit/push/HEAD parity не доказаны:

``` text
VERDICT B — CONTENT RECONCILED, FINAL GIT/EVIDENCE CLOSURE INCOMPLETE
```

------------------------------------------------------------------------

# 18. NEXT CANONICAL ACTION

После VERDICT A указать:

``` text
NEXT:
PHASE_3_DECISION_QUEUE_ROUND_5_SIGNAL_DESTINATION_SEMANTIC_RECONCILIATION
```

Но НЕ запускать его автоматически.

------------------------------------------------------------------------

# 19. STOP

После final report:

**STOP.**

Не запускать:

``` text
CRM Step 3.5
F.1–F.13 implementation
"Ожидают публикации" widget implementation
Decision Queue Round 5
```

до отдельной команды пользователя.
