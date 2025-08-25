import React, { useState, useEffect, useRef } from "react";
import ReactLogo from "../assets/react.svg";
import SettingsIcon from "../assets/settings.svg";

const Home = () => {
  const [chats, setChats] = useState([]);
  const [input, setInput] = useState("");
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userInput = input;
    setChats((prevChats) => [
      ...prevChats,
      { type: "text", content: userInput, sender: "user" },
    ]);
    setInput("");

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userInput }),
      });

      const backendResponse = await response.json();

      if (backendResponse.reply) {
        setChats((prevChats) => [
          ...prevChats,
          { type: "text", content: backendResponse.reply, sender: "ai" },
        ]);
      }

      if (backendResponse.videoUrl) {
        const fullVideoUrl = `http://localhost:3001${backendResponse.videoUrl}`;
        setChats((prevChats) => [
          ...prevChats,
          { type: "video", url: fullVideoUrl, sender: "ai" },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch from backend:", error);
      setChats((prevChats) => [
        ...prevChats,
        {
          type: "text",
          content: "Error: Could not connect to the server.",
          sender: "ai",
        },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats]);

  return (
    <div className="bg-offBlack w-screen h-screen flex">
      {/* left side */}
      <div className="w-[20vw] h-screen">
        <div className="flex flex-row justify-between items-center h-[10vh] p-[10px] box-border">
          <img src={ReactLogo} alt="logo" className="h-[20px] w-[20px]" />
          <button className="font-normal bg-darkBlack btn btn-soft">
            New Chat
          </button>
        </div>
        <hr className="h-[2px] bg-lightPurple border-0 ml-[10px]"></hr>
      </div>

      {/* partition */}
      <hr className="w-[2px] bg-lightPurple h-screen border-0"></hr>

      {/* right side */}
      <div className=" w-[80vw] h-screen relative flex flex-col">
        <div className="flex flex-row justify-between items-center h-[10vh] p-[10px] box-border">
          <h1 className="font-bold">AI-Math Tutor</h1>
          <img
            src={SettingsIcon}
            alt="settings"
            className="w-[20px] h-[20px] invert"
          />
        </div>
        <hr className="h-[2px] bg-lightPurple border-0"></hr>

        <div className="flex flex-col flex-1 bg-darkBlack overflow-auto pl-[10%] pr-[10%] pb-[2%]">
          {/* chat start */}

          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {chats.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-400">Ask anything to get started!</p>
              </div>
            ) : (
              chats.map((chat, index) => (
                <div
                  key={index}
                  className={`chat ${
                    chat.sender === "user" ? "chat-end" : "chat-start"
                  }`}
                >
                  <div className="chat-image avatar">
                    <div className="w-10 rounded-full">
                      <img
                        alt="Chat bubble avatar"
                        src={
                          chat.sender === "user"
                            ? "https://placehold.co/192x192/a1a1aa/ffffff?text=You"
                            : "https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
                        }
                      />
                    </div>
                  </div>
                  <div
                    className={`chat-bubble ${
                      chat.sender === "user" ? "bg-offBlack" : ""
                    }`}
                  >
                    {chat.type === "text" ? (
                      <p>{chat.content}</p>
                    ) : chat.type === "video" ? (
                      <video width="480" controls autoPlay muted loop>
                        <source src={chat.url} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* chat end */}
          <div className="pt-2">
            <textarea
              className="border border-lightPurple focus:outline-none w-full h-[100px] p-[10px] rounded-lg bg-darkBlack resize-none"
              placeholder="Ask anything"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
