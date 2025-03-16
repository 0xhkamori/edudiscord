const { VulcanJwtRegister, Keypair, VulcanHebeCe } = require('hebece');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config();

// Discord bot token - should be in .env file
const TOKEN = process.env.DISCORD_TOKEN;
const APIAP_VULCAN = process.env.VULCAN_APIAP;

// Parse the APIAP value from environment variable
// The environment variable should contain HTML page of eduvulcan.pl/api/ap
let jsonData;
try {
  const match = APIAP_VULCAN.match(/<input id="ap" type="hidden" value="(.*?)"><\/body>/);
  if (match && match[1]) {
    const htmlDecodedJson = match[1].replace(/&quot;/g, '"');
    jsonData = JSON.parse(htmlDecodedJson);
  } else {
    console.error('Could not extract JSON from APIAP_VULCAN environment variable');
    process.exit(1);
  }
} catch (error) {
  console.error('Error parsing APIAP_VULCAN:', error);
  process.exit(1);
}


const apiap = `<html><head></head><body><input id="ap" type="hidden" value='${JSON.stringify(jsonData)}' /></body></html>`;

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Function to format date to a readable format
function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Function to format time (e.g., "08:00" to "8:00 AM")
function formatTime(timeString) {
  if (!timeString) return 'N/A';
  
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  
  return `${formattedHour}:${minutes} ${period}`;
}

// Function to create a beautiful formatted output for lessons
function formatLessons(lessons) {
  if (!lessons) return '❌ Nie otrzymano danych o lekcjach.';
  
  let lessonArray = lessons;
  
  if (!Array.isArray(lessons) && typeof lessons === 'object') {
    if (lessons.Envelope && Array.isArray(lessons.Envelope)) {
      lessonArray = lessons.Envelope;
    } else if (lessons.Lessons && Array.isArray(lessons.Lessons)) {
      lessonArray = lessons.Lessons;
    } else if (lessons.Data && Array.isArray(lessons.Data)) {
      lessonArray = lessons.Data;
    } else {
      for (const key in lessons) {
        if (Array.isArray(lessons[key]) && lessons[key].length > 0) {
          if (lessons[key][0] && (
              lessons[key][0].Subject || 
              (lessons[key][0].Date && typeof lessons[key][0].Date === 'object') || 
              lessons[key][0].TimeFrom || 
              lessons[key][0].TimeSlot
          )) {
            lessonArray = lessons[key];
            break;
          }
        }
      }
    }
  }
  
  if (!Array.isArray(lessonArray) || lessonArray.length === 0) {
    return '❌ Nie znaleziono lekcji dla podanego zakresu dat.';
  }
  
  const lessonsByDate = {};
  
  lessonArray.forEach(lesson => {
    let dateString;
    let lessonDate;
    
    try {
      if (lesson.Date && typeof lesson.Date === 'object') {
        if (lesson.Date.Date) {
          dateString = lesson.Date.Date;
        } else if (lesson.Date.Timestamp) {
          lessonDate = new Date(lesson.Date.Timestamp);
        }
      } else if (lesson.Date && typeof lesson.Date === 'string') {
        dateString = lesson.Date;
      } else if (lesson.StartDate) {
        dateString = lesson.StartDate;
      } else if (lesson.day) {
        dateString = lesson.day;
      }
      
      if (dateString && !lessonDate) {
        lessonDate = new Date(dateString);
      }
      
      if (!lessonDate || isNaN(lessonDate.getTime())) {
        lessonDate = new Date();
      }
      
      const dateKey = lessonDate.toISOString().split('T')[0];
      
      if (!lessonsByDate[dateKey]) {
        lessonsByDate[dateKey] = {
          date: lessonDate,
          lessons: []
        };
      }
      
      lessonsByDate[dateKey].lessons.push(lesson);
    } catch (error) {
      console.error('Error processing lesson date:', error, lesson);
    }
  });

  if (Object.keys(lessonsByDate).length === 0) {
    return '❌ Nie znaleziono lekcji z prawidlowymi datami.';
  }

  const formattedDays = [];
  
  Object.values(lessonsByDate)
    .sort((a, b) => a.date - b.date)
    .forEach(dayData => {
      let dayOutput = `\n🗓️ **${formatDate(dayData.date)}**\n\n`;
      
      dayData.lessons
        .sort((a, b) => {
          const getTimeFrom = (lesson) => {
            if (lesson.TimeSlot && lesson.TimeSlot.Start) {
              return lesson.TimeSlot.Start;
            }
            return lesson.TimeFrom || lesson.startTime || lesson.Start || '';
          };
          
          const timeA = getTimeFrom(a);
          const timeB = getTimeFrom(b);
          return timeA.localeCompare(timeB);
        })
        .forEach((lesson) => {
          let timeFrom = '';
          let timeTo = '';
          
          if (lesson.TimeSlot) {
            timeFrom = lesson.TimeSlot.Start || '';
            timeTo = lesson.TimeSlot.End || '';
          } else {
            timeFrom = lesson.TimeFrom || lesson.startTime || lesson.Start || '';
            timeTo = lesson.TimeTo || lesson.endTime || lesson.End || '';
          }
          
          const timeInfo = timeFrom && timeTo 
            ? `${formatTime(timeFrom)}-${formatTime(timeTo)}`
            : 'Czas nieznany';
          
          let subject = 'Nieznany przedmiot';
          if (lesson.Subject) {
            if (typeof lesson.Subject === 'string') {
              subject = lesson.Subject;
            } else if (typeof lesson.Subject === 'object') {
              subject = lesson.Subject.Name || 'Nieznany przedmiot';
            }
          } else {
            subject = lesson.subject || lesson.Title || lesson.name || 'Nieznany przedmiot';
          }
          
          let room = '';
          if (lesson.Room) {
            if (typeof lesson.Room === 'string') {
              room = lesson.Room;
            } else if (typeof lesson.Room === 'object') {
              room = lesson.Room.Code || lesson.Room.Name || '';
            }
          } else if (lesson.room || lesson.ClassRoom) {
            room = lesson.room || lesson.ClassRoom;
          }
          
          dayOutput += `🕐 \`${timeInfo}\` | **${subject}**${room ? ` _(${room})_` : ''}\n`;
        });
      
      formattedDays.push(dayOutput);
    });
  
  return formattedDays;
}

// Function to get lessons for a specific date range
async function getLessons(startDate, endDate) {
  try {
    const keypair = await (new Keypair()).init();
    const jwt = await (new VulcanJwtRegister(keypair, apiap, 0)).init();
    const hebe = new VulcanHebeCe(keypair, jwt.Envelope.RestURL);
    await hebe.connect();
    
    const lessons = await hebe.getLessons(startDate, endDate);
    return lessons;
  } catch (error) {
    console.error('Error fetching lessons:', error);
    return null;
  }
}

// Function to get the lucky number
async function getLuckyNumber() {
  try {
    const keypair = await (new Keypair()).init();
    const jwt = await (new VulcanJwtRegister(keypair, apiap, 0)).init();
    const hebe = new VulcanHebeCe(keypair, jwt.Envelope.RestURL);
    await hebe.connect();
    
    const lucky = await hebe.getLuckyNumber();
    return lucky;
  } catch (error) {
    console.error('Error fetching lucky number:', error);
    return null;
  }
}

// Function to get homework assignments
async function getHomeworkAssignments(startDate, endDate) {
  try {
    const keypair = await (new Keypair()).init();
    const jwt = await (new VulcanJwtRegister(keypair, apiap, 0)).init();
    const hebe = new VulcanHebeCe(keypair, jwt.Envelope.RestURL);
    await hebe.connect();
    
    const homework = await hebe.getHomework(startDate, endDate);
    return homework;
  } catch (error) {
    console.error('Error fetching homework assignments:', error);
    return null;
  }
}

// Function to get exams
async function getExamsForDateRange(startDate, endDate) {
  try {
    const keypair = await (new Keypair()).init();
    const jwt = await (new VulcanJwtRegister(keypair, apiap, 0)).init();
    const hebe = new VulcanHebeCe(keypair, jwt.Envelope.RestURL);
    await hebe.connect();
    
    const exams = await hebe.getExams(startDate, endDate);
    return exams;
  } catch (error) {
    console.error('Error fetching exams:', error);
    return null;
  }
}

// Function to format exams
function formatExams(exams) {
  if (!exams) return '❌ Nie otrzymano danych o testach.';
  
  let examsArray = exams;
  
  if (!Array.isArray(exams) && typeof exams === 'object') {
    if (exams.Envelope && Array.isArray(exams.Envelope)) {
      examsArray = exams.Envelope;
    } else if (exams.Exams && Array.isArray(exams.Exams)) {
      examsArray = exams.Exams;
    } else if (exams.Data && Array.isArray(exams.Data)) {
      examsArray = exams.Data;
    } else {
      for (const key in exams) {
        if (Array.isArray(exams[key]) && exams[key].length > 0) {
          examsArray = exams[key];
          break;
        }
      }
    }
  }
  
  if (!Array.isArray(examsArray) || examsArray.length === 0) {
    return '❌ Nie znaleziono testow.';
  }
  
  const examsByDate = {};
  
  examsArray.forEach(exam => {
    let dateString;
    let examDate;
    
    try {
      if (exam.Deadline) {
        if (typeof exam.Deadline === 'string') {
          dateString = exam.Deadline;
        } else if (typeof exam.Deadline === 'object') {
          if (exam.Deadline.Date) {
            dateString = exam.Deadline.Date;
          } else if (exam.Deadline.Timestamp) {
            examDate = new Date(exam.Deadline.Timestamp);
          }
        }
      } else if (exam.Date) {
        if (typeof exam.Date === 'string') {
          dateString = exam.Date;
        } else if (typeof exam.Date === 'object') {
          if (exam.Date.Date) {
            dateString = exam.Date.Date;
          } else if (exam.Date.Timestamp) {
            examDate = new Date(exam.Date.Timestamp);
          }
        }
      }
      
      if (dateString && !examDate) {
        examDate = new Date(dateString);
      }
      
      if (!examDate || isNaN(examDate.getTime())) {
        examDate = new Date();
      }
      
      const dateKey = examDate.toISOString().split('T')[0];
      
      if (!examsByDate[dateKey]) {
        examsByDate[dateKey] = {
          date: examDate,
          exams: []
        };
      }
      
      examsByDate[dateKey].exams.push(exam);
    } catch (error) {
      console.error('Error processing exam date:', error, exam);
    }
  });
  
  if (Object.keys(examsByDate).length === 0) {
    return '❌ Nie znaleziono testow z prawidlowymi datami.';
  }
  
  const formattedDays = [];
  
  Object.values(examsByDate)
    .sort((a, b) => a.date - b.date)
    .forEach(dayData => {
      let dayOutput = `\n🗓️ **${formatDate(dayData.date)}**\n\n`;
      
      dayData.exams.forEach(exam => {
        let subject = 'Nieznany przedmiot';
        if (exam.Subject) {
          if (typeof exam.Subject === 'string') {
            subject = exam.Subject;
          } else if (typeof exam.Subject === 'object') {
            subject = exam.Subject.Name || 'Nieznany przedmiot';
          }
        }
        
        let content = '';
        if (exam.Content) {
          content = exam.Content;
        } else if (exam.Description) {
          content = exam.Description;
        } else if (exam.Text) {
          content = exam.Text;
        }
        
        dayOutput += `✍️ **${subject}**\n   _${content}_\n\n`;
      });
      
      formattedDays.push(dayOutput);
    });
  
  return formattedDays;
}

// Function to format homework assignments
function formatHomework(homework) {
  if (!homework) return '❌ Nie otrzymano danych o zadaniach.';
  
  let homeworkArray = homework;
  
  if (!Array.isArray(homework) && typeof homework === 'object') {
    if (homework.Homework && Array.isArray(homework.Homework)) {
      homeworkArray = homework.Homework;
    } else if (homework.Data && Array.isArray(homework.Data)) {
      homeworkArray = homework.Data;
    } else if (homework.Envelope && Array.isArray(homework.Envelope)) {
      homeworkArray = homework.Envelope;
    } else {
      for (const key in homework) {
        if (Array.isArray(homework[key]) && homework[key].length > 0) {
          homeworkArray = homework[key];
          break;
        }
      }
    }
  }
  
  if (!Array.isArray(homeworkArray) || homeworkArray.length === 0) {
    return '❌ Nie znaleziono zadan domowych.';
  }
  
  const homeworkByDate = {};
  
  homeworkArray.forEach(assignment => {
    let dateString;
    let assignmentDate;
    
    try {
      if (assignment.Date) {
        if (typeof assignment.Date === 'string') {
          dateString = assignment.Date;
        } else if (typeof assignment.Date === 'object') {
          if (assignment.Date.Date) {
            dateString = assignment.Date.Date;
          } else if (assignment.Date.Timestamp) {
            assignmentDate = new Date(assignment.Date.Timestamp);
          }
        }
      } else if (assignment.DeadlineDate) {
        if (typeof assignment.DeadlineDate === 'string') {
          dateString = assignment.DeadlineDate;
        } else if (typeof assignment.DeadlineDate === 'object') {
          if (assignment.DeadlineDate.Date) {
            dateString = assignment.DeadlineDate.Date;
          } else if (assignment.DeadlineDate.Timestamp) {
            assignmentDate = new Date(assignment.DeadlineDate.Timestamp);
          }
        }
      }
      
      if (dateString && !assignmentDate) {
        assignmentDate = new Date(dateString);
      }
      
      if (!assignmentDate || isNaN(assignmentDate.getTime())) {
        assignmentDate = new Date();
      }
      
      const dateKey = assignmentDate.toISOString().split('T')[0];
      
      if (!homeworkByDate[dateKey]) {
        homeworkByDate[dateKey] = {
          date: assignmentDate,
          assignments: []
        };
      }
      
      homeworkByDate[dateKey].assignments.push(assignment);
    } catch (error) {
      console.error('Error processing homework date:', error, assignment);
    }
  });
  
  if (Object.keys(homeworkByDate).length === 0) {
    return '❌ Nie znaleziono zadan domowych z prawidlowymi datami.';
  }
  
  const formattedDays = [];
  
  Object.values(homeworkByDate)
    .sort((a, b) => a.date - b.date)
    .forEach(dayData => {
      let dayOutput = `\n🗓️ **${formatDate(dayData.date)}**\n\n`;
      
      dayData.assignments.forEach(assignment => {
        let subject = 'Nieznany przedmiot';
        if (assignment.Subject) {
          if (typeof assignment.Subject === 'string') {
            subject = assignment.Subject;
          } else if (typeof assignment.Subject === 'object') {
            subject = assignment.Subject.Name || 'Nieznany przedmiot';
          }
        }
        
        let content = '';
        if (assignment.Content) {
          content = assignment.Content;
        } else if (assignment.Description) {
          content = assignment.Description;
        } else if (assignment.Text) {
          content = assignment.Text;
        }
        
        dayOutput += `📖 **${subject}**\n   _${content}_\n\n`;
      });
      
      formattedDays.push(dayOutput);
    });
  
  return formattedDays;
}

// When the client is ready, run this code (only once)
client.once('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}!`);
  console.log('Bot jest gotowy do pokazania twojego planu lekcji!');
});

// Function to create the help message
function createHelpMessage() {
  return `\n📘 **EduDiscord** v0.1.5 by **@0xhkamori**\n
**Komendy:**
\`!plan\` - Plan na dzis
\`!data\` - Plan na tydzien
\`!data RRRR-MM-DD\` - Plan od daty
\`!numerek\` - Szczesliwy numerek
\`!zadanie\` - Zadania na jutro
\`!testy\` - Testy (14 dni)
\`!pomoc\` - Pomoc`;
}

// Listen for messages
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  if (message.mentions.has(client.user) && !message.mentions.everyone) {
    await message.channel.send(createHelpMessage());
    return;
  }
  
  if (message.content.startsWith('!pomoc')) {
    await message.channel.send(createHelpMessage());
    return;
  }
  
  if (message.content.startsWith('!data')) {
    const args = message.content.split(' ');
    
    let startDate, endDate;
    
    if (args.length >= 2 && args[1].match(/^\d{4}-\d{2}-\d{2}$/)) {
      startDate = new Date(args[1]);
      
      if (args.length >= 3 && args[2].match(/^\d{4}-\d{2}-\d{2}$/)) {
        endDate = new Date(args[2]);
      } else {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
      }
    } else {
      const today = new Date();
      startDate = new Date(today);
      
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startDate.setDate(diff);
      
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    }
    
    const loadingMessage = await message.channel.send('🔄 Pobieram plan...');
    
    try {
      const lessons = await getLessons(startDate, endDate);
      
      if (!lessons) {
        await loadingMessage.edit('❌ Nie udalo sie pobrac planu.');
        return;
      }
      
      const formattedDays = formatLessons(lessons);
      
      if (typeof formattedDays === 'string') {
        await loadingMessage.edit(formattedDays);
        return;
      }
      
      await loadingMessage.delete();
      
      const dateRangeStr = formatDateRange(startDate, endDate);
      await message.channel.send(`\n📗 **Plan lekcji**${dateRangeStr}`);
      
      for (const dayOutput of formattedDays) {
        await message.channel.send(dayOutput);
      }
    } catch (error) {
      console.error('Error handling !data command:', error);
      await loadingMessage.edit('❌ Wystapil blad podczas przetwarzania zapytania.');
    }
  }
  
  else if (message.content.startsWith('!plan')) {
    const today = new Date();
    const startDate = new Date(today);
    const endDate = new Date(today);
    
    const loadingMessage = await message.channel.send('🔄 Pobieram plan na dzis...');
    
    try {
      const lessons = await getLessons(startDate, endDate);
      
      if (!lessons) {
        await loadingMessage.edit('❌ Nie udalo sie pobrac planu.');
        return;
      }
      
      const formattedDays = formatLessons(lessons);
      
      if (typeof formattedDays === 'string') {
        await loadingMessage.edit(formattedDays);
        return;
      }
      
      await loadingMessage.delete();
      
      if (formattedDays.length === 0) {
        await message.channel.send('✨ Brak lekcji na dzis!');
      } else {
        for (const dayOutput of formattedDays) {
          await message.channel.send(dayOutput);
        }
      }
    } catch (error) {
      console.error('Error handling !plan command:', error);
      await loadingMessage.edit('❌ Wystapil blad podczas przetwarzania zapytania.');
    }
  }
  
  else if (message.content.startsWith('!numerek')) {
    const loadingMessage = await message.channel.send('🔄 Pobieram numerek...');
    
    try {
      const luckyNumber = await getLuckyNumber();
      
      if (!luckyNumber) {
        await loadingMessage.edit('❌ Nie udalo sie pobrac numerka.');
        return;
      }
      
      let luckyNumberValue = 'Nieznany';
      let luckyNumberDate = new Date();
      
      if (typeof luckyNumber === 'object') {
        if (luckyNumber.LuckyNumber !== undefined) {
          luckyNumberValue = luckyNumber.LuckyNumber;
        } else if (luckyNumber.Number !== undefined) {
          luckyNumberValue = luckyNumber.Number;
        } else if (luckyNumber.Value !== undefined) {
          luckyNumberValue = luckyNumber.Value;
        }
        
        if (luckyNumber.Date) {
          if (typeof luckyNumber.Date === 'string') {
            luckyNumberDate = new Date(luckyNumber.Date);
          } else if (luckyNumber.Date.Date) {
            luckyNumberDate = new Date(luckyNumber.Date.Date);
          } else if (luckyNumber.Date.Timestamp) {
            luckyNumberDate = new Date(luckyNumber.Date.Timestamp);
          }
        }
      } else if (typeof luckyNumber === 'number') {
        luckyNumberValue = luckyNumber;
      }
      
      await loadingMessage.edit(`🎲 Numerek na ${formatDate(luckyNumberDate)}: **${luckyNumberValue}**`);
    } catch (error) {
      console.error('Error handling !numerek command:', error);
      await loadingMessage.edit('❌ Wystapil blad podczas przetwarzania zapytania.');
    }
  }
  
  else if (message.content.startsWith('!zadanie')) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startDate = new Date(tomorrow);
    const endDate = new Date(tomorrow);
    
    const loadingMessage = await message.channel.send('🔄 Pobieram zadania...');
    
    try {
      const homework = await getHomeworkAssignments(startDate, endDate);
      
      if (!homework) {
        await loadingMessage.edit('❌ Nie udalo sie pobrac zadan.');
        return;
      }
      
      const formattedHomework = formatHomework(homework);
      
      await loadingMessage.delete();
      
      if (typeof formattedHomework === 'string' && formattedHomework.includes('Nie znaleziono')) {
        await message.channel.send('✨ Brak zadan na jutro! 🎉');
      } else if (Array.isArray(formattedHomework)) {
        for (const dayOutput of formattedHomework) {
          await message.channel.send(dayOutput);
        }
      } else {
        await message.channel.send(formattedHomework);
      }
    } catch (error) {
      console.error('Error handling !zadanie command:', error);
      await loadingMessage.edit('❌ Wystapil blad podczas przetwarzania zapytania.');
    }
  }
  
  else if (message.content.startsWith('!testy')) {
    const args = message.content.split(' ');
    
    let startDate, endDate;
    
    if (args.length >= 2 && args[1].match(/^\d{4}-\d{2}-\d{2}$/)) {
      startDate = new Date(args[1]);
      
      if (args.length >= 3 && args[2].match(/^\d{4}-\d{2}-\d{2}$/)) {
        endDate = new Date(args[2]);
      } else {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 14);
      }
    } else {
      startDate = new Date();
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 14);
    }
    
    const loadingMessage = await message.channel.send('🔄 Pobieram sprawdziany...');
    
    try {
      const exams = await getExamsForDateRange(startDate, endDate);
      
      if (!exams) {
        await loadingMessage.edit('❌ Nie udalo sie pobrac testow.');
        return;
      }
      
      const formattedExams = formatExams(exams);
      
      if (typeof formattedExams === 'string') {
        await loadingMessage.edit(formattedExams);
        return;
      }
      
      await loadingMessage.delete();
      
      if (formattedExams.length === 0) {
        await message.channel.send('\n✨ **Brak testow!** 🎉');
      } else {
        const dateRangeStr = formatDateRange(startDate, endDate);
        await message.channel.send(`\n✍️ **Testy**${dateRangeStr}`);
        
        for (const dayOutput of formattedExams) {
          await message.channel.send(dayOutput);
        }
      }
    } catch (error) {
      console.error('Error handling !testy command:', error);
      await loadingMessage.edit('❌ Wystapil blad podczas przetwarzania zapytania.');
    }
  }
});

// Login to Discord with your token
client.login(TOKEN);

// Create a .env file template if it doesn't exist
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', 'DISCORD_TOKEN=your_discord_bot_token_here');
  console.log('Created .env file. Please add your Discord bot token to it.');
}

console.log('Starting Discord bot...');

// Update the date range string format in relevant commands
const formatDateRange = (startDate, endDate) => {
  return `\n🗓️ **${startDate.toLocaleDateString('pl-PL')} - ${endDate.toLocaleDateString('pl-PL')}**\n`;
};