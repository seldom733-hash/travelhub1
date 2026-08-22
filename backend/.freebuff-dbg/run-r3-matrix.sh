#!/bin/bash
# Round 3 frozen matrix — sequential driver. Each gate: fresh container, same isolated DB.
set -u
export MSYS_NO_PATHCONV=1
COMMON="-e DATABASE_URL=postgresql://postgres:postgres@thq-pg:5432/travelhub_r3 -e JWT_SECRET=dev-jwt-secret-change-in-prod -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=admin123 -v /d/travelhub_v1/backend/artifacts:/app/artifacts -w /app"
FINAL="--dataset=REPRESENTATIVE --final --apps=2 --workers=2 --allow-non-local"

run_gate() {
  local id="$1"; shift
  echo "[$(date +%H:%M:%S)] START $id"
  docker run --rm --network thq-r3 $COMMON thq-r3-backend npx ts-node src/perf/run.ts --profile "$@" --run-id "$id" $FINAL > "/tmp/r3-$id.log" 2>&1
  echo "[$(date +%H:%M:%S)] DONE $id exit=$?"
}

run_gate r3-booking-steady booking-order-steady --concurrency=40
run_gate r3-payment-steady payment-steady
run_gate r3-payment-burst payment-burst
run_gate r3-payment-conc payment-concurrency
run_gate r3-login-qual login-qualification
run_gate r3-login-burst login-burst
run_gate r3-eb-steady eventbus-steady --workers=2
run_gate r3-eb-burst eventbus-burst --seed-events=1000 --workers=2
run_gate r3-eb-recovery eventbus-recovery --seed-events=5000 --workers=2
run_gate r3-multi multi-instance --rps=100
run_gate r3-qual-steady qual-steady
run_gate r3-qual-peak qual-peak
run_gate r3-qual-burst qual-burst
run_gate r3-qual-soak qual-soak
echo "[$(date +%H:%M:%S)] ALL GATES DONE"
