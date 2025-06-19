import React from 'react'
import GoogleIcon from '../assets/google.svg'
import { useState } from 'react'

const LogIn = () => {

  const [isRegistered, setIsRegistered] = useState(false);

  return (
    <div className='loginBox'>
      <h1>{isRegistered ? 'Login' : 'Register'}</h1>
      <h3>{isRegistered ? 'Hi, Welcome back' : "Create your account"}</h3>

      <button className='googleBtn'><img src= {GoogleIcon} alt='google icon' className='googleIcon'/>{isRegistered ?'Login with Google' : 'Register with Google'}</button>
      <h3>or</h3>
      <form>
        <label>
        Email
        </label>
        <input></input>
        <label>Password</label>
        <input></input>
      </form>

      <button>{isRegistered ? 'Login' : 'Register'}</button>
      <h3>{isRegistered ? 'Not registered yet?' : 'Already have an account?'} <a href='#' onClick={
        (e)=>{
          e.preventDefault();
          setIsRegistered(!isRegistered)
        }
        }>{isRegistered ? 'Create an account' : 'Login'}</a></h3>
    </div>
  )
}

export default LogIn
