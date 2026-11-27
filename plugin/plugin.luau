--!nocheck
--# selene: allow(unused_variable, global_usage)

local runService = game:GetService("RunService")
local studioTests = game:GetService("StudioTestService")

local function canActivate()
	return runService:IsEdit() and studioTests.EditModeActive
end

local pmIcon
pcall(function()
	local image = game:GetService("AssetService")
		:CreateEditableImage({ Size = Vector2.new(48, 48) })
	local pixels = game:GetService("EncodingService")
		:Base64Decode(buffer.fromstring("__PM_ICON_BASE64__"))
	image:WritePixelsBuffer(Vector2.zero, Vector2.new(48, 48), pixels)
	pmIcon = Content.fromObject(image)
end)

local toolbar = plugin:CreateToolbar("PM SPOOFER")
local button = toolbar:CreateButton(
	"IspooferMotionPanel",
	"Turn PM SPOOFER on or off in this place",
	"",
	"PM SPOOFER"
)
button.ClickableWhenViewportHidden = true
if pmIcon then
	pcall(function()
		button.IconContent = pmIcon
	end)
end

local current = nil
local function stopSession()
	local session = current
	if not session then
		return
	end
	current = nil
	session.active = false
	for _, connection in session.connections do
		connection:Disconnect()
	end
	for thread in session.threads do
		if thread ~= coroutine.running() and coroutine.status(thread) ~= "dead" then
			pcall(task.cancel, thread)
		end
	end
	if session.recording then
		pcall(function()
			game:GetService("ChangeHistoryService")
				:FinishRecording(session.recording, Enum.FinishRecordingOperation.Commit)
		end)
	end
	if session.close then
		session.close()
	end
	button:SetActive(false)
end

local function initialize(session)
	local function connectSessionInput(signal, callback)
		table.insert(session.connections, signal:Connect(callback))
	end
	local function spawnSessionTask(callback, ...)
		if session.active then
			local thread = coroutine.create(callback)
			session.threads[thread] = true
			task.spawn(thread, ...)
		end
	end
	local function delaySessionTask(seconds, callback)
		if session.active then
			session.threads[task.delay(seconds, callback)] = true
		end
	end
	--#include "runtime.luau"
end

local function activate()
	if current or not canActivate() then
		return
	end
	local session =
		{ active = true, connections = {}, threads = setmetatable({}, { __mode = "k" }) }
	current = session
	local ok, reason = pcall(initialize, session)
	if not ok then
		stopSession()
		warn("[PM SPOOFER] Could not start: " .. tostring(reason))
	elseif current == session then
		button:SetActive(true)
	end
end

button.Click:Connect(function()
	if current then
		stopSession()
	else
		activate()
	end
end)
local action = plugin:CreatePluginAction(
	"IspooferMotionOpenPanel",
	"Open PM SPOOFER",
	"Activate PM SPOOFER in this place",
	"",
	true
)
action.Triggered:Connect(activate)

local function updateMode()
	button.Enabled = canActivate()
	if not button.Enabled then
		stopSession()
	end
end
studioTests:GetPropertyChangedSignal("EditModeActive"):Connect(updateMode)
plugin.Unloading:Connect(stopSession)
updateMode()
