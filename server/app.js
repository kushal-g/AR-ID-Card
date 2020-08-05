const express = require("express");
const chalk = require("chalk");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const cors = require("cors");
const path = require("path");
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/api/sis", async (req, res, next) => {
  console.log(req.body);
  try {
    const result = await openBrowser({ ...req.body });
    res.status(200).send({ result });
  } catch (e) {
    res.sendStatus(500);
  }
});

const openBrowser = async ({ USN, DOB }) => {
  let name,
    marks = [],
    courseCodes = [],
    courseNames = [];

  console.log(chalk.yellow("Launching browser..."));
  const browser = await puppeteer.launch({ headless: true });
  console.log(chalk.green("Browser launched!"));
  console.log(chalk.yellow("Opening page..."));
  const page = await browser.newPage();
  console.log(chalk.green("Opened!"));
  console.log(chalk.yellow("Going to sis..."));
  await page.goto("http://parents.msrit.edu/index.php");
  await page.waitFor("#username");
  await page.waitFor("#password");
  console.log(chalk.yellow("Logging in..."));
  await page.type("#username", USN);
  await page.type("#password", DOB);
  await page.click("input[name=submit]");

  console.log(chalk.green("Logged in!"));

  console.log(chalk.yellow("Reading details..."));
  //Extracts name
  await page.waitFor(
    "#sub-container > div > div:nth-child(2) > div:nth-child(2)"
  );
  const nameElement = await page.$(
    "#sub-container > div > div:nth-child(2) > div:nth-child(2)"
  );
  const nameProperty = await nameElement.getProperty("textContent");
  name = await nameProperty.jsonValue();
  name = name.trim();

  //Extracts marks
  await page.waitFor(
    "#sub-container > div > div:nth-child(3) > table > tbody > tr > td:nth-child(4) > div > a:nth-child(1)"
  );

  const marksElements = await page.$$(
    "#sub-container > div > div:nth-child(3) > table > tbody > tr > td:nth-child(4) > div > a:nth-child(1)"
  );

  for (let i = 0; i < marksElements.length; i++) {
    let mark = marksElements[i];
    const attendanceProperty = await mark.getProperty("textContent");
    marks.push(await attendanceProperty.jsonValue());
  }

  //Extracts course codes
  await page.waitFor(".courseCode");
  const courseCodeElements = await page.$$(".courseCode");
  for (let i = 0; i < courseCodeElements.length; i++) {
    let courseCode = courseCodeElements[i];
    const courseCodeProperty = await courseCode.getProperty("textContent");
    courseCodes.push(await courseCodeProperty.jsonValue());
  }

  await page.waitFor(".coursename");
  const courseNameElements = await page.$$(".coursename");
  for (let i = 0; i < courseNameElements.length; i++) {
    let courseName = courseNameElements[i];
    const courseNameProperty = await courseName.getProperty("textContent");
    courseNames.push(await courseNameProperty.jsonValue());
  }

  let courseDetails = [];
  for (let i = 0; i < marks.length; i++) {
    courseDetails.push({
      courseCode: courseCodes[i],
      marks: marks[i],
      courseName: courseNames[i],
    });
  }

  console.log(
    {
      name,
      courseDetails,
    },
    chalk.green("Details sent!")
  );
  return {
    name,
    courseDetails,
  };
};

app.listen(process.env.PORT, () => {
  console.log(chalk.magenta(`Server listening to port ${process.env.PORT}`));
});
