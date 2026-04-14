NEWMAN_COLLECTION := "dev/Postman/my-api.postman_collection.json"
NEWMAN_RESULTS    := tests/results/newman

# Select environment file based on ENV variable (default: local)
ifeq ($(ENV),ci)
  NEWMAN_ENV := dev/Postman/environment.ci.postman_environment.json
else
  NEWMAN_ENV := dev/Postman/environment.local.postman_environment.json
endif

# Run all individual requests as a smoke test, or a specific flow if FLOW= is set
test-newman:
	@mkdir -p $(NEWMAN_RESULTS)
	@if [ -n "${FLOW}" ]; then \
		node dev/Postman/run-flow.js "${FLOW}"; \
	else \
		npx newman run $(NEWMAN_COLLECTION) \
			--folder Requests \
			--environment "$(NEWMAN_ENV)" \
			--reporters cli,junit,htmlextra \
			--reporter-junit-export $(NEWMAN_RESULTS)/results.xml \
			--reporter-htmlextra-export $(NEWMAN_RESULTS)/report.html; \
	fi

# Run every flow in dev/Postman/flows/ automatically
test-newman-flows:
	@mkdir -p $(NEWMAN_RESULTS)
	@for flow_file in dev/Postman/flows/*.json; do \
		flow_name=$$(node -e "process.stdout.write(require('./'+'$$flow_file').name)"); \
		echo ""; \
		echo "▶ Flow: $$flow_name"; \
		node dev/Postman/run-flow.js "$$flow_name" || exit 1; \
	done
