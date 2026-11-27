--!nocheck
--!nolint

local DISCOVERY_REQUEST_TIMEOUT_SECS = 5

local MAX_CONCURRENT_PROBES = 8

local function responseLooksLikeAppHealth(decoded: any): boolean
	return type(decoded) == "table" and decoded.app == "ISpooferMotion"
end

local function probeUrl(
	url: string,
	results: { { url: string, startedAt: number, health: any } },
	pendingRef: { number },
	cancelledRef: { boolean },
	statsRef: { responded: number, wrongApp: number, error: string? }
)
	if cancelledRef[1] then
		pendingRef[1] -= 1
		return
	end

	local ok, response = pcall(function()
		return HttpService:RequestAsync({
			Url = url .. "/health",
			Method = "GET",
			Timeout = DISCOVERY_REQUEST_TIMEOUT_SECS,
		})
	end)

	if not cancelledRef[1] then
		if ok and response and response.Success then
			statsRef.responded += 1
			local decodedOk, decoded = decodeJsonResponseBody(response)
			if decodedOk and responseLooksLikeAppHealth(decoded) then
				local startedAt = tonumber(decoded.startedAt) or 0
				table.insert(results, {
					url = url,
					startedAt = startedAt,
					health = decoded,
				})
			else
				statsRef.wrongApp += 1
			end
		else
			local detail = ok and ("HTTP " .. tostring(response and response.StatusCode))
				or tostring(response)
			local lowerDetail = string.lower(detail)
			if
				not statsRef.error
				or string.find(lowerDetail, "permission", 1, true)
				or string.find(lowerDetail, "denied", 1, true)
			then
				statsRef.error = url .. "/health: " .. string.sub(detail, 1, 400)
			end
		end
	end
	pendingRef[1] -= 1
end

local function discoverServer(): (boolean, boolean, string?)
	-- Plugin HTTP permissions are independent of the experience's HttpEnabled setting.
	-- Try the local request and report its actual result instead of blocking here.
	local results: { { url: string, startedAt: number, health: any } } = {}
	local cancelledRef = { false }
	local statsRef = { responded = 0, wrongApp = 0, error = nil :: string? }

	local portStart = PORT_START
	local portEnd = PORT_END
	if portStart > portEnd then
		portStart, portEnd = portEnd, portStart
	end

	local urls: { string } = {}
	if BASE_URL then
		table.insert(urls, BASE_URL)
	end
	for port = portStart, portEnd do
		local url = "http://127.0.0.1:" .. port
		if url ~= BASE_URL then
			table.insert(urls, url)
		end
	end
	for port = portStart, portEnd do
		local url = "http://localhost:" .. port
		if url ~= BASE_URL then
			table.insert(urls, url)
		end
	end

	local idx = 1
	while idx <= #urls do
		local batchPending = { 0 }
		-- Make the usual first connection alone so Studio can present one permission prompt.
		local batchSize = idx == 1 and 1 or math.min(MAX_CONCURRENT_PROBES, #urls - idx + 1)

		for j = idx, idx + batchSize - 1 do
			batchPending[1] += 1
			spawnSessionTask(probeUrl, urls[j], results, batchPending, cancelledRef, statsRef)
		end

		-- Let RequestAsync enforce its timeout. A separate timer could discard a
		-- successful response while the user is answering Studio's permission prompt.
		while batchPending[1] > 0 do
			task.wait(0.05)
		end

		if #results > 0 then
			break
		end

		idx += batchSize
	end

	cancelledRef[1] = true

	table.sort(results, function(a, b)
		return a.startedAt > b.startedAt
	end)

	if #results > 0 then
		local best = results[1]
		local changed = BASE_URL ~= best.url
		BASE_URL = best.url

		if best.health and best.health.batchSize then
			if type(setPluginBatchSize) == "function" then
				setPluginBatchSize(best.health.batchSize)
			end
		end

		return true, changed
	end

	local reason
	if statsRef.wrongApp > 0 then
		reason = string.format(
			"Found a server on ports %d-%d but it isn't PM SPOOFER. Close other apps using these ports.",
			portStart,
			portEnd
		)
	else
		reason = string.format(
			"Cannot reach the desktop app on ports %d-%d. Keep PM SPOOFER open and allow this local plugin to access localhost / 127.0.0.1 when Studio prompts.",
			portStart,
			portEnd
		)
	end
	if statsRef.error then
		reason ..= "\nStudio request error: " .. statsRef.error
	end
	return false, false, reason
end
