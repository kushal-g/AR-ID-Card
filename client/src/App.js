import React, { useEffect, useState, useRef, useCallback } from "react";
import { createWorker, createScheduler } from "tesseract.js";

import "./App.css";

function App() {
  const scheduler = useRef(createScheduler());
  const videoElement = useRef();
  const timerId = useRef(null);
  const [USN, setUSN] = useState(null);
  const [DOB, setDOB] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [courseResult, setCourseResult] = useState([]);
  const [name, setName] = useState("");

  const doOCR = useCallback(async () => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;

    c.getContext("2d").drawImage(videoElement.current, 0, 0, 640, 360);

    const {
      data: { text },
    } = await scheduler.current.addJob("recognize", c);

    text.split("\n").forEach((line) => {
      setUSN((prevUSN) => prevUSN ?? checkUSN(line));
      setDOB((prevDOB) => prevDOB ?? checkDOB(line));
    });
  }, [USN, DOB]);

  const previousDoOCR = usePrevious(doOCR);

  useEffect(() => {
    initializeTesseract();
  }, []);

  const initializeTesseract = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    videoElement.current.srcObject = stream;
    console.log(videoElement, stream);
    console.log("Initializing...");
    for (let i = 0; i < 4; i++) {
      const worker = createWorker();
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      scheduler.current.addWorker(worker);
    }
    console.log("Initialized");
    videoElement.current.play();
  };

  useEffect(() => {
    if (isPlaying) {
      if (previousDoOCR != doOCR) {
        console.log("OCR CHANGED");
        clearInterval(timerId.current);
      }
      timerId.current = setInterval(doOCR, 1000);
    } else {
      clearInterval(timerId.current);
    }

    if (USN != null && DOB != null) {
      console.log(USN, DOB);
      clearInterval(timerId.current);

      fetch(`http://localhost:8080/sis`, {
        method: "post",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify({
          USN,
          DOB,
        }),
      })
        .then((response) => response.json())
        .then((body) => {
          console.log(body);
          setCourseResult(body.result.courseDetails);
          setName(body.result.name);
        });
    }
  }, [isPlaying, doOCR]);

  useEffect(() => {
    clearInterval(timerId);
  }, [USN, DOB]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const checkUSN = (line) => {
    if (line.includes("USN")) {
      try {
        let usnVal = line.split("USN")[1].replace(/\s+/g, "");
        let strippedUSN = usnVal.split("1MS")[1].slice(0, 7).toUpperCase();
        let usnRegex = /^[0-9]{2}(IS|CS|15|C5|I5)[0-9]{3}$/;
        let branch = strippedUSN.match(usnRegex)[1];
        if (branch === "I5" || branch === "15") {
          strippedUSN = strippedUSN.replace(branch, "IS");
        } else if (branch === "C5") {
          strippedUSN = strippedUSN.replace(branch, "CS");
        }
        console.log("1MS" + strippedUSN);
        return "1MS" + strippedUSN;
      } catch (e) {
        console.error(e);
        return null;
      }
    }
    return null;
  };

  const checkDOB = (line) => {
    let dateRegex = /([0-3][0-9])\/([0-1][0-9])\/(\d{2})/;
    let matchedArray = line.match(dateRegex);
    if (matchedArray != null) {
      console.log(matchedArray[0]);
      let dd = matchedArray[1];
      let mm = matchedArray[2];
      let yy = matchedArray[3];

      let yyyy = Number(yy) <= 20 && Number(yy) >= 0 ? "20" + yy : "19" + yy;
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  };

  return (
    <div className="App">
      <p>
        {USN} {DOB}
      </p>
      <video
        ref={videoElement}
        onPlay={handlePlay}
        onPause={handlePause}
        id="video"
        width="640"
        height="360"
        crossOrigin="anonymous"
      ></video>
      <p>{name}</p>
      {courseResult.length !== 0 && (
        <table>
          <tr>
            <th>Course Code</th>
            <th>Course Name</th>
            <th>Marks</th>
          </tr>
          {courseResult.map((res) => (
            <tr>
              <td>{res.courseCode}</td>
              <td>{res.courseName}</td>
              <td>{res.marks}</td>
            </tr>
          ))}
        </table>
      )}
    </div>
  );
}

export default App;

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
