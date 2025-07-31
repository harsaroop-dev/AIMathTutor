import React from "react";
import ReactLogo from "../assets/react.svg";
import SettingsIcon from "../assets/settings.svg";

const Home = () => {
  let chats = [];
  for (let i = 0; i < 100; i++) {
    chats.push(
      <div className="chat chat-start">
        <div className="chat-image avatar">
          <div className="w-10 rounded-full">
            <img
              alt="Tailwind CSS chat bubble component"
              src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
            />
          </div>
        </div>
        <div className="chat-bubble">
          It was said that you would, destroy the Sith, not join them.
        </div>
      </div>
    );
  }
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
          <div className="overflow-auto">{chats}</div>
          {/* chat end */}

          <div className="pt-2">
            <textarea
              className="border border-lightPurple focus:outline-none w-full h-[100px] p-[10px] rounded-lg bg-darkBlack resize-none"
              placeholder="Ask anything"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
